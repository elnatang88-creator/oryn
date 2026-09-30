-- Founders' decision (2026-09-30): when a signed-in ORYN member views a capsule, the owner can see who
-- it was (Premium). The viewer is told at view time and can switch to private viewing in Settings.
-- People without an ORYN account remain anonymous.

ALTER TABLE users ADD COLUMN profile_headline TEXT NOT NULL DEFAULT '';
ALTER TABLE users ADD COLUMN industry TEXT;
ALTER TABLE users ADD COLUMN view_visibility TEXT NOT NULL DEFAULT 'visible' CHECK (view_visibility IN ('visible', 'private'));

-- One row per (capsule, viewer): first and last time an identified ORYN member viewed it.
CREATE TABLE capsule_views (
  id              TEXT PRIMARY KEY,
  capsule_id      TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  owner_user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  viewer_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_session_id TEXT REFERENCES share_sessions(id) ON DELETE SET NULL,
  expanded        BOOLEAN NOT NULL DEFAULT FALSE,
  view_count      INTEGER NOT NULL DEFAULT 1,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_viewed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (capsule_id, viewer_user_id)
);
CREATE INDEX capsule_views_owner_idx ON capsule_views(owner_user_id, last_viewed_at DESC);

-- Interest analytics: which detail a recipient tapped (anonymous; kind only, never who).
ALTER TABLE interactions ADD COLUMN field_kind TEXT;
ALTER TABLE interactions DROP CONSTRAINT interactions_kind_check;
ALTER TABLE interactions ADD CONSTRAINT interactions_kind_check CHECK (kind IN ('opened','expanded','saved_vcard','connect_requested','kept','dismissed','reported','blocked_revoked','blocked_expired','blocked_claimed','field_clicked'));

-- Premium capability: see which ORYN members viewed you, and interest analytics.
UPDATE plan_catalog SET capabilities = capabilities || '["insights.viewers"]'::jsonb WHERE key IN ('pro', 'business', 'enterprise');
