-- Refactor EventCategory: from global shared categories to per-event owned categories
-- Replace AgeGroup enum with date-of-birth fields, add name, add eventId

-- Step 1: Clear foreign key references to event_categories (dev data only)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'players' AND column_name = 'category_id'
    ) THEN
        EXECUTE 'UPDATE "players" SET "category_id" = NULL WHERE "category_id" IS NOT NULL';
    END IF;
END $$;
UPDATE "matches" SET "event_category_id" = NULL WHERE "event_category_id" IS NOT NULL;

-- Step 2: Drop the junction table (no longer needed — categories belong directly to events)
DROP TABLE IF EXISTS "event_event_categories";

-- Step 3: Delete all existing categories (incompatible with new structure)
DELETE FROM "event_categories";

-- Step 4: Drop old unique constraint
DROP INDEX IF EXISTS "event_categories_sport_type_age_group_gender_key";

-- Step 5: Drop the age_group column (replaced by date-of-birth fields)
ALTER TABLE "event_categories" DROP COLUMN IF EXISTS "age_group";

-- Step 6: Add new columns
ALTER TABLE "event_categories" ADD COLUMN "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "event_categories" ADD COLUMN "event_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "event_categories" ADD COLUMN "max_date_of_birth" TIMESTAMP(3) NOT NULL DEFAULT '2000-01-01T00:00:00.000Z';
ALTER TABLE "event_categories" ADD COLUMN "min_date_of_birth" TIMESTAMP(3);

-- Step 7: Remove defaults (they were only needed for the ALTER)
ALTER TABLE "event_categories" ALTER COLUMN "name" DROP DEFAULT;
ALTER TABLE "event_categories" ALTER COLUMN "event_id" DROP DEFAULT;
ALTER TABLE "event_categories" ALTER COLUMN "max_date_of_birth" DROP DEFAULT;

-- Step 8: Add foreign key from event_categories to events
ALTER TABLE "event_categories" ADD CONSTRAINT "event_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 9: Add new unique constraint and index
CREATE UNIQUE INDEX "event_categories_event_id_name_key" ON "event_categories"("event_id", "name");
CREATE INDEX "event_categories_event_id_idx" ON "event_categories"("event_id");

-- Step 10: Add players.category_id column and FK if not exists (fixes migration drift)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'players' AND column_name = 'category_id'
    ) THEN
        ALTER TABLE "players" ADD COLUMN "category_id" TEXT;
        CREATE INDEX "players_category_id_idx" ON "players"("category_id");
        ALTER TABLE "players" ADD CONSTRAINT "players_category_id_fkey"
            FOREIGN KEY ("category_id") REFERENCES "event_categories"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
