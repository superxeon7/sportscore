-- Create category_groups table (linked directly to event_categories, not to category_stages)
CREATE TABLE IF NOT EXISTS "category_groups" (
  "id"           TEXT        NOT NULL DEFAULT gen_random_uuid()::text,
  "category_id"  TEXT        NOT NULL,
  "name"         TEXT        NOT NULL,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "category_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "category_groups_category_id_fkey"
    FOREIGN KEY ("category_id") REFERENCES "event_categories"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "category_groups_category_id_name_key"
  ON "category_groups"("category_id", "name");

CREATE INDEX IF NOT EXISTS "category_groups_category_id_idx"
  ON "category_groups"("category_id");

-- Migrate existing event_category_teams.group_id:
-- The current FK points to stage_groups. Drop it and re-point to category_groups.
ALTER TABLE "event_category_teams"
  DROP CONSTRAINT IF EXISTS "event_category_teams_group_id_fkey";

-- Nullify any dangling group_id values that referenced stage_groups
-- (since those stage_group IDs won't exist in category_groups)
UPDATE "event_category_teams" SET "group_id" = NULL WHERE "group_id" IS NOT NULL;

-- Add new FK pointing to category_groups
ALTER TABLE "event_category_teams"
  ADD CONSTRAINT "event_category_teams_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "category_groups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Add stageType, groupId, groupName columns to matches
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "stage_type" TEXT;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "group_id"   TEXT;
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "group_name" TEXT;

-- Add FK from matches.group_id to category_groups
ALTER TABLE "matches"
  ADD CONSTRAINT "matches_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "category_groups"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
