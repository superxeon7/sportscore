-- Drop the separate stage_group_teams table (replaced by groupId on event_category_teams)
DROP TABLE IF EXISTS "stage_group_teams";

-- Remove old string 'group' column
ALTER TABLE "event_category_teams" DROP COLUMN IF EXISTS "group";

-- Add groupId FK column
ALTER TABLE "event_category_teams" ADD COLUMN "group_id" TEXT;

-- Add foreign key constraint
ALTER TABLE "event_category_teams" ADD CONSTRAINT "event_category_teams_group_id_fkey"
  FOREIGN KEY ("group_id") REFERENCES "stage_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
