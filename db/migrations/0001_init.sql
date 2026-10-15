-- ORYN v1 schema. Plain PostgreSQL (runs on managed Postgres and on embedded PGlite for local dev/tests).
-- Tenant boundaries: every row that belongs to a person carries owner_user_id; every row that belongs to a
-- business workspace carries org_id. Services must scope every query by one of those (see lib/server/authz.ts).

CREATE TABLE users (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,              -- stored lower-cased
  password_hash      TEXT NOT NULL,
  display_name       TEXT NOT NULL,
  plan_key           TEXT NOT NULL DEFAULT 'free',
  is_platform_admin  BOOLEAN NOT NULL DEFAULT FALSE,
  retention_days     INTEGER,                           -- NULL = plan default
  onboarded_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE TABLE devices (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id    TEXT REFERENCES devices(id) ON DELETE SET NULL,
  token_hash   TEXT NOT NULL UNIQUE,                   -- SHA-256 of the cookie token; raw token never stored
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ NOT NULL,
  revoked_at   TIMESTAMPTZ
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

CREATE TABLE organizations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  plan_key    TEXT NOT NULL DEFAULT 'business',
  brand       JSONB NOT NULL DEFAULT '{}'::jsonb,       -- {accent, logoText}
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE teams (
  id         TEXT PRIMARY KEY,
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Membership = the Permission binding. Role -> permission matrix lives in lib/server/permissions.ts.
CREATE TABLE memberships (
  org_id     TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('owner','admin','manager','member')),
  team_id    TEXT REFERENCES teams(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE capsules (
  id             TEXT PRIMARY KEY,
  owner_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id         TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,                        -- owner-facing label, e.g. "Conference"
  mode           TEXT NOT NULL CHECK (mode IN ('professional','business','event','personal','social','creator','hiring','custom')),
  display_name   TEXT NOT NULL,
  headline       TEXT NOT NULL DEFAULT '',
  message        TEXT NOT NULL DEFAULT '',             -- optional short personal message (Instant View)
  avatar_url     TEXT,
  accent         TEXT NOT NULL DEFAULT 'blue',
  fields         JSONB NOT NULL DEFAULT '[]'::jsonb,   -- [{id,kind,label,value,layer:'instant'|'expanded'|'hidden'}]
  primary_action JSONB,                                -- {fieldId} or null
  private_note   TEXT NOT NULL DEFAULT '',             -- OWNER ONLY. Never projected to recipients.
  is_default     BOOLEAN NOT NULL DEFAULT FALSE,
  status         TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  version        INTEGER NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX capsules_owner_idx ON capsules(owner_user_id);

-- Default policy for new shares of a capsule. Each share session copies these into its own columns.
CREATE TABLE visibility_policies (
  capsule_id         TEXT PRIMARY KEY REFERENCES capsules(id) ON DELETE CASCADE,
  duration_minutes   INTEGER,                          -- NULL = no automatic expiry
  one_time           BOOLEAN NOT NULL DEFAULT FALSE,
  interaction_level  TEXT NOT NULL DEFAULT 'connect' CHECK (interaction_level IN ('view','save','connect')),
  allow_expanded     BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  venue       TEXT NOT NULL DEFAULT '',
  starts_on   DATE,
  ends_on     DATE,
  rules       JSONB NOT NULL DEFAULT '{}'::jsonb,      -- {allowedKinds:[...], allowPhone:bool, shareScope:'event'|'public'}
  status      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','live','ended')),
  created_by  TEXT NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX events_org_idx ON events(org_id);

CREATE TABLE event_participants (
  id            TEXT PRIMARY KEY,
  event_id      TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  org_id        TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id       TEXT REFERENCES users(id) ON DELETE SET NULL,
  email         TEXT NOT NULL,
  display_name  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'attendee' CHECK (role IN ('attendee','exhibitor','speaker','staff')),
  capsule_id    TEXT REFERENCES capsules(id) ON DELETE SET NULL,
  status        TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','active','removed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, email)
);

CREATE TABLE stations (
  id          TEXT PRIMARY KEY,
  org_id      TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  event_id    TEXT REFERENCES events(id) ON DELETE SET NULL,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('booth','table','desk','room','counter','person')),
  capsule_id  TEXT REFERENCES capsules(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE share_sessions (
  id                 TEXT PRIMARY KEY,
  capsule_id         TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  owner_user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id             TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  event_id           TEXT REFERENCES events(id) ON DELETE SET NULL,
  station_id         TEXT REFERENCES stations(id) ON DELETE CASCADE,
  channel            TEXT NOT NULL,                    -- link|qr|web_share|nfc_tag|wallet_pass|shortcut|station
  scope              TEXT NOT NULL DEFAULT 'public' CHECK (scope IN ('public','limited','event','organization','recipient')),
  context_label      TEXT NOT NULL DEFAULT '',         -- owner-facing: "Tech Summit, Hall B"
  one_time           BOOLEAN NOT NULL DEFAULT FALSE,
  claim_hash         TEXT,                             -- one-time: hash of the first recipient's claim cookie
  interaction_level  TEXT NOT NULL DEFAULT 'connect',
  allow_expanded     BOOLEAN NOT NULL DEFAULT TRUE,
  recipient_email_hash TEXT,                           -- recipient-specific scope
  max_views          INTEGER,
  view_count         INTEGER NOT NULL DEFAULT 0,
  expanded_count     INTEGER NOT NULL DEFAULT 0,
  saved_count        INTEGER NOT NULL DEFAULT 0,
  expires_at         TIMESTAMPTZ,
  revoked_at         TIMESTAMPTZ,
  last_capsule_version INTEGER,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX share_sessions_owner_idx ON share_sessions(owner_user_id, created_at DESC);

CREATE TABLE qr_destinations (
  code          TEXT PRIMARY KEY,                     -- short random code printed on the QR/NFC tag
  org_id        TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  station_id    TEXT REFERENCES stations(id) ON DELETE CASCADE,
  share_session_id TEXT NOT NULL REFERENCES share_sessions(id) ON DELETE CASCADE,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- A recipient is an anonymous browser until they choose to identify themselves.
CREATE TABLE recipients (
  id          TEXT PRIMARY KEY,
  user_id     TEXT REFERENCES users(id) ON DELETE SET NULL,
  name        TEXT,
  contact     TEXT,                                   -- the one way to reach them they chose to give
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Interactions: identifiable only when recipient_id is set, which only happens after a voluntary action.
CREATE TABLE interactions (
  id                TEXT PRIMARY KEY,
  share_session_id  TEXT NOT NULL REFERENCES share_sessions(id) ON DELETE CASCADE,
  owner_user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id      TEXT REFERENCES recipients(id) ON DELETE SET NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('opened','expanded','saved_vcard','connect_requested','kept','dismissed','reported','blocked_revoked','blocked_expired','blocked_claimed')),
  capsule_version   INTEGER,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX interactions_owner_idx ON interactions(owner_user_id, created_at DESC);

CREATE TABLE connection_requests (
  id                TEXT PRIMARY KEY,
  share_session_id  TEXT NOT NULL REFERENCES share_sessions(id) ON DELETE CASCADE,
  owner_user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id      TEXT NOT NULL REFERENCES recipients(id) ON DELETE CASCADE,
  from_name         TEXT NOT NULL,
  from_contact      TEXT NOT NULL,
  message           TEXT NOT NULL DEFAULT '',
  status            TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at      TIMESTAMPTZ
);
CREATE INDEX connection_requests_owner_idx ON connection_requests(owner_user_id, status);

CREATE TABLE connections (
  id                TEXT PRIMARY KEY,
  owner_user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  org_id            TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  contact_user_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  headline          TEXT NOT NULL DEFAULT '',
  contact           JSONB NOT NULL DEFAULT '[]'::jsonb, -- only what the other person chose to share
  source            TEXT NOT NULL CHECK (source IN ('request_accepted','kept_capsule','manual')),
  share_session_id  TEXT REFERENCES share_sessions(id) ON DELETE SET NULL,
  event_id          TEXT REFERENCES events(id) ON DELETE SET NULL,
  met_where         TEXT NOT NULL DEFAULT '',
  met_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX connections_owner_idx ON connections(owner_user_id, met_at DESC);

CREATE TABLE private_notes (
  id             TEXT PRIMARY KEY,
  connection_id  TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  owner_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE follow_ups (
  id             TEXT PRIMARY KEY,
  connection_id  TEXT NOT NULL REFERENCES connections(id) ON DELETE CASCADE,
  owner_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  due_on         DATE NOT NULL,
  done_at        TIMESTAMPTZ,
  reminded_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX follow_ups_owner_idx ON follow_ups(owner_user_id, due_on);

-- Plan catalog is data, not code: prices and limits can change without a rebuild.
CREATE TABLE plan_catalog (
  key           TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  rank          INTEGER NOT NULL,
  capabilities  JSONB NOT NULL,                       -- ["capsules.multiple", ...]
  limits        JSONB NOT NULL,                       -- {"capsules": 1, "historyDays": 30}
  price_label   TEXT,                                 -- NULL until research sets it
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id            TEXT PRIMARY KEY,
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('user','organization')),
  subject_id    TEXT NOT NULL,
  plan_key      TEXT NOT NULL REFERENCES plan_catalog(key),
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','canceled','past_due')),
  provider      TEXT NOT NULL DEFAULT 'manual',        -- 'manual' until a payment provider is chosen
  provider_ref  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (subject_type, subject_id)
);

-- Append-only. No UPDATE/DELETE paths exist in the service layer.
CREATE TABLE audit_events (
  id             TEXT PRIMARY KEY,
  actor_user_id  TEXT,
  org_id         TEXT,
  action         TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      TEXT,
  meta           JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_actor_idx ON audit_events(actor_user_id, created_at DESC);
CREATE INDEX audit_events_org_idx ON audit_events(org_id, created_at DESC);

CREATE TABLE data_exports (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','ready','expired')),
  payload       JSONB,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ready_at      TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ
);

CREATE TABLE deletion_requests (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','canceled','completed')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_for  TIMESTAMPTZ NOT NULL,
  completed_at   TIMESTAMPTZ
);

CREATE TABLE jobs (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  run_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  status      TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','done','failed')),
  attempts    INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX jobs_due_idx ON jobs(status, run_at);

CREATE TABLE feature_flags (
  key         TEXT PRIMARY KEY,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE analytics_events (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  user_id     TEXT,                                   -- the ORYN account acting; never a recipient identity
  org_id      TEXT,
  props       JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX analytics_events_name_idx ON analytics_events(name, created_at);

CREATE TABLE rate_limits (
  key           TEXT PRIMARY KEY,
  window_start  TIMESTAMPTZ NOT NULL,
  count         INTEGER NOT NULL
);

CREATE TABLE notifications (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  body        TEXT NOT NULL,
  link        TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed: plan catalog (capabilities agreed by founders; prices intentionally unset).
INSERT INTO plan_catalog (key, name, rank, capabilities, limits) VALUES
 ('free', 'Free', 0,
  '["share.link","share.qr","connections.basic"]',
  '{"capsules":1,"historyDays":30}'),
 ('pro', 'Pro', 1,
  '["share.link","share.qr","connections.basic","capsules.multiple","disclosure.controls","followups","notes.private","branding.advanced","share.nfc","share.wallet","history.extended","insights.personal"]',
  '{"capsules":10,"historyDays":365}'),
 ('business', 'Business', 2,
  '["share.link","share.qr","connections.basic","capsules.multiple","disclosure.controls","followups","notes.private","branding.advanced","share.nfc","share.wallet","history.extended","insights.personal","org.workspace","org.brand","org.roles","events","stations","insights.org","org.admin","data.export.org","audit.logs","org.controls"]',
  '{"capsules":25,"historyDays":730,"seats":50}'),
 ('enterprise', 'Enterprise', 3,
  '["share.link","share.qr","connections.basic","capsules.multiple","disclosure.controls","followups","notes.private","branding.advanced","share.nfc","share.wallet","history.extended","insights.personal","org.workspace","org.brand","org.roles","events","stations","insights.org","org.admin","data.export.org","audit.logs","org.controls","sso","scim","access.policies","support.dedicated","retention.custom","security.review","domains.custom","api","data.regional"]',
  '{"capsules":100,"historyDays":3650,"seats":100000}');

INSERT INTO feature_flags (key, enabled, description) VALUES
 ('share.nfc_tag', TRUE, 'Offer Web NFC tag writing on supported Android browsers'),
 ('share.wallet_pass', FALSE, 'Wallet pass download (needs company-owned signing certificates)'),
 ('personal.safety_prompts', TRUE, 'Extra safety copy on Personal/Social capsules'),
 ('events.self_checkin', FALSE, 'Participants join an event by scanning an event code');
