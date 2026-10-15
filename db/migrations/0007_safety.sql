-- Safety (2026-10-15): blocking and abuse reports for Nearby and member requests.
-- A block is private: the blocked person is never told; they simply stop seeing each other.
CREATE TABLE user_blocks (
  blocker_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_user_id, blocked_user_id)
);
CREATE INDEX user_blocks_blocked_idx ON user_blocks(blocked_user_id);

-- Reports go to the platform team (Command Center). Free text is capped; no location, no device data.
CREATE TABLE abuse_reports (
  id                TEXT PRIMARY KEY,
  reporter_user_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason            TEXT NOT NULL CHECK (reason IN ('spam','harassment','impersonation','inappropriate','other')),
  details           TEXT NOT NULL DEFAULT '',
  surface           TEXT NOT NULL DEFAULT 'nearby',
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX abuse_reports_status_idx ON abuse_reports(status, created_at);
