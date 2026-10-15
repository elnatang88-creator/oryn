-- Platform slice (2026-10-15): verified email + reset, outbox email, event registration/tickets/check-in,
-- leads (CRM), tasks, automations, station modes, public usernames. No personal data in analytics tables.

-- ── Accounts ─────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE users ADD COLUMN email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN notify_email BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN ai_consent_at TIMESTAMPTZ;

-- One-time tokens (email verification, password reset). Only the hash is stored.
CREATE TABLE auth_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('verify_email', 'reset_password')),
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX auth_tokens_user_idx ON auth_tokens(user_id, kind);

-- Every email the platform wants to send goes through here (transactional only; no marketing).
CREATE TABLE email_outbox (
  id          TEXT PRIMARY KEY,
  to_email    TEXT NOT NULL,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  kind        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  text_body   TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  sent_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX email_outbox_status_idx ON email_outbox(status, created_at);

-- ── Events: public page, registration, tickets, check-in ─────────────────────────────────────────
ALTER TABLE events ADD COLUMN slug TEXT UNIQUE;
ALTER TABLE events ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE events ADD COLUMN timezone TEXT NOT NULL DEFAULT 'UTC';
ALTER TABLE events ADD COLUMN starts_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN ends_at TIMESTAMPTZ;
ALTER TABLE events ADD COLUMN capacity INTEGER CHECK (capacity IS NULL OR capacity > 0);
ALTER TABLE events ADD COLUMN published BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE events ADD COLUMN registration_open BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE events ADD COLUMN waitlist BOOLEAN NOT NULL DEFAULT TRUE;
-- Custom registration questions: [{id, label, kind:'text'|'select'|'checkbox', required, options?}]
ALTER TABLE events ADD COLUMN registration_fields JSONB NOT NULL DEFAULT '[]'::jsonb;
-- Ticket types: [{id, name, price_label|null, quantity|null}]. A priced type cannot be sold until a payment provider exists.
ALTER TABLE events ADD COLUMN ticket_types JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE events ADD COLUMN brand JSONB NOT NULL DEFAULT '{}'::jsonb;

-- A registration IS the ticket: its signed token (hash stored) is what the QR encodes.
CREATE TABLE registrations (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         TEXT REFERENCES users(id) ON DELETE SET NULL,
  email           TEXT NOT NULL,
  name            TEXT NOT NULL,
  company         TEXT NOT NULL DEFAULT '',
  ticket_type_id  TEXT,
  answers         JSONB NOT NULL DEFAULT '{}'::jsonb,
  status          TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlisted', 'cancelled')),
  token_hash      TEXT NOT NULL UNIQUE,
  checked_in_at   TIMESTAMPTZ,
  checked_in_by   TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);
CREATE INDEX registrations_event_idx ON registrations(event_id, status, created_at);

CREATE TABLE check_ins (
  id               TEXT PRIMARY KEY,
  registration_id  TEXT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  event_id         TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  staff_user_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  method           TEXT NOT NULL CHECK (method IN ('scan', 'manual')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX check_ins_event_idx ON check_ins(event_id, created_at DESC);

-- ── Workspace CRM ────────────────────────────────────────────────────────────────────────────────
ALTER TABLE organizations ADD COLUMN pipeline_stages JSONB NOT NULL DEFAULT '["New","Contacted","Qualified","Meeting Scheduled","Proposal","Won","Lost"]'::jsonb;

CREATE TABLE leads (
  id                TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id          TEXT REFERENCES events(id) ON DELETE SET NULL,
  station_id        TEXT REFERENCES stations(id) ON DELETE SET NULL,
  source            TEXT NOT NULL CHECK (source IN ('station', 'form', 'manual', 'registration', 'booth')),
  name              TEXT NOT NULL,
  email             TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  company           TEXT NOT NULL DEFAULT '',
  message           TEXT NOT NULL DEFAULT '',
  consent_at        TIMESTAMPTZ,                       -- the person agreed to be contacted
  stage             TEXT NOT NULL DEFAULT 'New',
  assignee_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  tags              TEXT[] NOT NULL DEFAULT '{}',
  created_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX leads_org_idx ON leads(org_id, stage, updated_at DESC);
CREATE INDEX leads_assignee_idx ON leads(assignee_user_id);

CREATE TABLE lead_notes (
  id              TEXT PRIMARY KEY,
  lead_id         TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  org_id          TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  author_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  body            TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tasks (
  id                TEXT PRIMARY KEY,
  org_id            TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  lead_id           TEXT REFERENCES leads(id) ON DELETE CASCADE,
  assignee_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  title             TEXT NOT NULL,
  due_on            DATE,
  done_at           TIMESTAMPTZ,
  reminded_at       TIMESTAMPTZ,
  created_by        TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tasks_org_idx ON tasks(org_id, done_at, due_on);

-- ── Automations ──────────────────────────────────────────────────────────────────────────────────
CREATE TABLE automations (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  trigger     TEXT NOT NULL,                           -- lead.created | registration.created | checkin.created | lead.stage_changed | task.due | connection.created
  conditions  JSONB NOT NULL DEFAULT '{}'::jsonb,      -- e.g. {"stage":"Qualified"} / {"source":"station"}
  actions     JSONB NOT NULL DEFAULT '[]'::jsonb,      -- [{type:'create_task',...},{type:'assign_lead',...},{type:'notify',...},{type:'send_email',...},{type:'update_stage',...}]
  enabled     BOOLEAN NOT NULL DEFAULT TRUE,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX automations_org_idx ON automations(org_id, trigger, enabled);

CREATE TABLE automation_runs (
  id               TEXT PRIMARY KEY,
  automation_id    TEXT NOT NULL REFERENCES automations(id) ON DELETE CASCADE,
  org_id           TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  trigger          TEXT NOT NULL,
  subject_id       TEXT NOT NULL,
  idempotency_key  TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'done', 'failed')),
  result           JSONB NOT NULL DEFAULT '[]'::jsonb,
  error            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at      TIMESTAMPTZ
);
CREATE INDEX automation_runs_org_idx ON automation_runs(org_id, created_at DESC);

-- ── Stations v2 ──────────────────────────────────────────────────────────────────────────────────
ALTER TABLE stations ADD COLUMN mode TEXT NOT NULL DEFAULT 'card'
  CHECK (mode IN ('card', 'lead', 'registration', 'checkin', 'booking', 'link'));
ALTER TABLE stations ADD COLUMN destination_url TEXT;        -- booking/link modes: https:// only, validated in the service
ALTER TABLE stations ADD COLUMN config JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE stations ADD COLUMN activated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE stations ADD COLUMN transfer_code_hash TEXT;     -- set when the owner starts a transfer

-- Scan analytics without personal data: what happened at which station, when.
CREATE TABLE station_interactions (
  id          TEXT PRIMARY KEY,
  station_id  TEXT NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('scan', 'lead', 'registration', 'link', 'booking', 'checkin')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX station_interactions_idx ON station_interactions(station_id, created_at DESC);

-- Jobs: new kinds are plain strings already; nothing to change.
