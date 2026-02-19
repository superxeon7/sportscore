-- CreateEnum
CREATE TYPE "SportType" AS ENUM ('FOOTBALL', 'FUTSAL', 'BASKETBALL', 'VOLLEYBALL', 'HANDBALL', 'HOCKEY', 'TENNIS', 'BADMINTON', 'TABLE_TENNIS', 'RUGBY', 'BASEBALL', 'SOFTBALL', 'CRICKET', 'OTHER');

-- CreateEnum
CREATE TYPE "AgeGroup" AS ENUM ('U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'U20', 'U23', 'SENIOR', 'VETERAN', 'OPEN');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'MIXED');

-- CreateTable
CREATE TABLE "event_categories" (
    "id" TEXT NOT NULL,
    "sport_type" "SportType" NOT NULL,
    "age_group" "AgeGroup" NOT NULL,
    "gender" "Gender" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_event_categories" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "event_category_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_event_categories_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Add category fields to teams
ALTER TABLE "teams" ADD COLUMN "sport_type" "SportType";
ALTER TABLE "teams" ADD COLUMN "age_group" "AgeGroup";
ALTER TABLE "teams" ADD COLUMN "gender" "Gender";

-- AlterTable: Add event_category_id to matches
ALTER TABLE "matches" ADD COLUMN "event_category_id" TEXT;

-- CreateIndex: Unique constraint on event_categories (sport_type, age_group, gender)
CREATE UNIQUE INDEX "event_categories_sport_type_age_group_gender_key" ON "event_categories"("sport_type", "age_group", "gender");

-- CreateIndex: Unique constraint on event_event_categories (event_id, event_category_id)
CREATE UNIQUE INDEX "event_event_categories_event_id_event_category_id_key" ON "event_event_categories"("event_id", "event_category_id");

-- CreateIndex
CREATE INDEX "event_event_categories_event_category_id_idx" ON "event_event_categories"("event_category_id");

-- CreateIndex: Index on matches.event_category_id
CREATE INDEX "matches_event_category_id_idx" ON "matches"("event_category_id");

-- Fix duplicate manager_id values before adding unique constraint.
-- For each manager that manages multiple teams, keep only the first team (by created_at)
-- and reassign duplicates to new placeholder manager users.
DO $$
DECLARE
    dup RECORD;
    new_manager_id TEXT;
    seq INT := 1;
BEGIN
    -- Find all duplicate teams (not the first one per manager)
    FOR dup IN
        SELECT t."id" AS team_id, t."manager_id", t."name" AS team_name
        FROM "teams" t
        INNER JOIN (
            SELECT "manager_id"
            FROM "teams"
            GROUP BY "manager_id"
            HAVING COUNT(*) > 1
        ) dups ON t."manager_id" = dups."manager_id"
        WHERE t."id" NOT IN (
            -- Keep the earliest team per manager
            SELECT DISTINCT ON ("manager_id") "id"
            FROM "teams"
            ORDER BY "manager_id", "created_at" ASC
        )
        ORDER BY t."created_at" ASC
    LOOP
        -- Create a placeholder manager user for the orphaned team
        new_manager_id := gen_random_uuid()::TEXT;
        INSERT INTO "users" ("id", "email", "password_hash", "first_name", "last_name", "role", "is_active", "created_at", "updated_at")
        VALUES (
            new_manager_id,
            'migrated-manager-' || seq || '@placeholder.local',
            '$2b$12$placeholder.hash.not.a.real.password.value',
            'Migrated',
            'Manager ' || seq,
            'TEAM_MANAGER',
            true,
            NOW(),
            NOW()
        );
        -- Reassign the team
        UPDATE "teams" SET "manager_id" = new_manager_id WHERE "id" = dup.team_id;
        seq := seq + 1;
    END LOOP;
END $$;

-- DropIndex: Drop the old non-unique index on teams.manager_id before adding unique constraint
DROP INDEX "teams_manager_id_idx";

-- CreateIndex: Enforce one manager per team (unique constraint)
CREATE UNIQUE INDEX "teams_manager_id_key" ON "teams"("manager_id");

-- AddForeignKey
ALTER TABLE "event_event_categories" ADD CONSTRAINT "event_event_categories_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_event_categories" ADD CONSTRAINT "event_event_categories_event_category_id_fkey" FOREIGN KEY ("event_category_id") REFERENCES "event_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_event_category_id_fkey" FOREIGN KEY ("event_category_id") REFERENCES "event_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
