-- Relationship memory + attribution (2026-09-30).
-- Every connection remembers: whose card I received (a snapshot of its face), which of MY cards I used,
-- the channel it came through, and my own tags. Private to the owner of the connection row.
-- their card face at connect time (design, name, headline, company)
ALTER TABLE connections ADD COLUMN card JSONB;
ALTER TABLE connections ADD COLUMN my_capsule_id TEXT REFERENCES capsules(id) ON DELETE SET NULL;
-- nearby | qr | link | web_share | wallet_pass | station | shortcut | kept | manual
ALTER TABLE connections ADD COLUMN channel TEXT;
ALTER TABLE connections ADD COLUMN tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX connections_owner_capsule_idx ON connections(owner_user_id, my_capsule_id);

-- Backfill attribution for existing rows from the share they came through.
UPDATE connections c SET channel = s.channel, my_capsule_id = s.capsule_id
  FROM share_sessions s WHERE c.share_session_id = s.id AND c.source = 'request_accepted' AND c.channel IS NULL;
UPDATE connections SET channel = 'kept' WHERE source = 'kept_capsule' AND channel IS NULL;
UPDATE connections SET channel = 'manual' WHERE source = 'manual' AND channel IS NULL;

-- A permanent link (Wallet pass) can follow whichever card is currently active, so the pass never needs reissuing.
ALTER TABLE share_sessions ADD COLUMN follow_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Analytics: one coherent schema. Payloads carry ids and enums only, never personal data.
ALTER TABLE analytics_events ADD COLUMN session_id TEXT;
CREATE INDEX analytics_events_user_idx ON analytics_events(user_id, created_at);
