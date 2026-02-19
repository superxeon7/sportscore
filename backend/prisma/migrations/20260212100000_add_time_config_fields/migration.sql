-- AlterTable: Add time configuration fields to event_categories
ALTER TABLE "event_categories" ADD COLUMN "match_duration_minutes" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "event_categories" ADD COLUMN "half_count" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "event_categories" ADD COLUMN "break_duration_minutes" INTEGER NOT NULL DEFAULT 15;
ALTER TABLE "event_categories" ADD COLUMN "injury_time_minutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add optional time override fields to matches
ALTER TABLE "matches" ADD COLUMN "match_duration_minutes" INTEGER;
ALTER TABLE "matches" ADD COLUMN "half_count" INTEGER;
ALTER TABLE "matches" ADD COLUMN "break_duration_minutes" INTEGER;
ALTER TABLE "matches" ADD COLUMN "injury_time_minutes" INTEGER;
