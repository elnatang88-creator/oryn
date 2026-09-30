-- Card design per capsule: material, foil, finish, font, layout and an optional custom base colour.
-- Validated in the service layer (lib/card-design.ts); the check below is a second line of defence.
ALTER TABLE capsules ADD COLUMN design JSONB NOT NULL DEFAULT '{"material":"obsidian","foil":"gold","finish":"foil","font":"classic","layout":"monogram","base":"#0f3d2e"}'::jsonb;
ALTER TABLE capsules ADD CONSTRAINT capsules_design_is_object CHECK (jsonb_typeof(design) = 'object' AND pg_column_size(design) < 2048);
