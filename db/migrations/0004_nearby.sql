-- ORYN-to-ORYN Nearby (founders' decision 2026-09-30: build #1 Nearby first, Wallet as part of the same identity).
-- Nearby is opt-in. The server never receives coordinates: the phone reduces its position to a coarse
-- area cell (geohash, 7 characters ≈ 150 m) before sending it, and presence rows expire within minutes.

-- Who may discover me: off (default) | everyone nearby | only my connections | only people at the same event.
ALTER TABLE users ADD COLUMN nearby_visibility TEXT NOT NULL DEFAULT 'off'
  CHECK (nearby_visibility IN ('off', 'everyone', 'connections', 'event'));

-- Short-lived presence while someone has Share/Nearby open. One row per person; deleted when they leave.
CREATE TABLE nearby_presence (
  user_id     TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  handle      TEXT NOT NULL UNIQUE,              -- random per activation; clients never see user ids
  capsule_id  TEXT NOT NULL REFERENCES capsules(id) ON DELETE CASCADE,
  cell        TEXT,                              -- coarse area cell, or NULL (event-only presence)
  event_id    TEXT REFERENCES events(id) ON DELETE CASCADE,
  visibility  TEXT NOT NULL CHECK (visibility IN ('everyone', 'connections', 'event')),
  started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL
);
CREATE INDEX nearby_presence_cell_idx ON nearby_presence(cell, expires_at);
CREATE INDEX nearby_presence_event_idx ON nearby_presence(event_id, expires_at);

-- Member-to-member requests reuse connection_requests (one request pipeline, one People list).
ALTER TABLE connection_requests ADD COLUMN kind TEXT NOT NULL DEFAULT 'link' CHECK (kind IN ('link', 'member'));
ALTER TABLE connection_requests ADD COLUMN from_user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
CREATE UNIQUE INDEX connection_requests_member_pending ON connection_requests(owner_user_id, from_user_id) WHERE kind = 'member' AND status = 'pending';

ALTER TABLE connections DROP CONSTRAINT connections_source_check;
ALTER TABLE connections ADD CONSTRAINT connections_source_check CHECK (source IN ('request_accepted', 'kept_capsule', 'manual', 'nearby'));
