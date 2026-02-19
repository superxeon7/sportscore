/*
  Warnings:

  - You are about to drop the column `category_id` on the `players` table. All the data in the column will be lost.
  - You are about to drop the `event_teams` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `lineups` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OfficialRole" AS ENUM ('COACH', 'ASSISTANT_COACH', 'MANAGER', 'PHYSIO', 'OTHER');

-- AlterEnum: Add new MatchStatus values
-- Must use IF NOT EXISTS and be outside transaction for PG compatibility
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'DRAFT' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'MatchStatus')) THEN
        ALTER TYPE "MatchStatus" ADD VALUE 'DRAFT';
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PUBLISHED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'MatchStatus')) THEN
        ALTER TYPE "MatchStatus" ADD VALUE 'PUBLISHED';
    END IF;
END $$;

-- DropForeignKey
ALTER TABLE "event_teams" DROP CONSTRAINT "event_teams_event_id_fkey";

-- DropForeignKey
ALTER TABLE "event_teams" DROP CONSTRAINT "event_teams_team_id_fkey";

-- DropForeignKey
ALTER TABLE "lineups" DROP CONSTRAINT "lineups_match_id_fkey";

-- DropForeignKey
ALTER TABLE "lineups" DROP CONSTRAINT "lineups_team_id_fkey";

-- DropForeignKey
ALTER TABLE "players" DROP CONSTRAINT "players_category_id_fkey";

-- DropIndex
DROP INDEX "players_category_id_idx";

-- AlterTable
ALTER TABLE "event_categories" ADD COLUMN     "max_roster_size" INTEGER NOT NULL DEFAULT 20;

-- AlterTable
ALTER TABLE "matches" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "players" DROP COLUMN "category_id";

-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN     "event_category_id" TEXT;

-- DropTable
DROP TABLE "event_teams";

-- DropTable
DROP TABLE "lineups";

-- CreateTable
CREATE TABLE "event_category_teams" (
    "id" TEXT NOT NULL,
    "event_category_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "seed" INTEGER,
    "group" TEXT,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_category_teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_lineups" (
    "id" TEXT NOT NULL,
    "match_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "match_lineups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_lineup_players" (
    "id" TEXT NOT NULL,
    "lineup_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "jersey_number" INTEGER NOT NULL,
    "is_starter" BOOLEAN NOT NULL DEFAULT true,
    "is_captain" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "match_lineup_players_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_rosters" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "category_rosters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "category_officials" (
    "id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "OfficialRole" NOT NULL,
    "photo_url" TEXT,
    "is_head_coach" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "category_officials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_divisions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sport_type" "SportType",
    "age_group" "AgeGroup",
    "gender" "Gender",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_divisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "division_players" (
    "id" TEXT NOT NULL,
    "division_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "division_players_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_category_teams_event_category_id_idx" ON "event_category_teams"("event_category_id");

-- CreateIndex
CREATE INDEX "event_category_teams_team_id_idx" ON "event_category_teams"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_category_teams_event_category_id_team_id_key" ON "event_category_teams"("event_category_id", "team_id");

-- CreateIndex
CREATE INDEX "match_lineups_match_id_idx" ON "match_lineups"("match_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_lineups_match_id_team_id_key" ON "match_lineups"("match_id", "team_id");

-- CreateIndex
CREATE INDEX "match_lineup_players_lineup_id_idx" ON "match_lineup_players"("lineup_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_lineup_players_lineup_id_player_id_key" ON "match_lineup_players"("lineup_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_lineup_players_lineup_id_jersey_number_key" ON "match_lineup_players"("lineup_id", "jersey_number");

-- CreateIndex
CREATE INDEX "category_rosters_team_id_category_id_idx" ON "category_rosters"("team_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_rosters_category_id_player_id_key" ON "category_rosters"("category_id", "player_id");

-- CreateIndex
CREATE UNIQUE INDEX "category_rosters_category_id_team_id_player_id_key" ON "category_rosters"("category_id", "team_id", "player_id");

-- CreateIndex
CREATE INDEX "category_officials_team_id_category_id_idx" ON "category_officials"("team_id", "category_id");

-- CreateIndex
CREATE INDEX "team_divisions_team_id_idx" ON "team_divisions"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_divisions_team_id_name_key" ON "team_divisions"("team_id", "name");

-- CreateIndex
CREATE INDEX "division_players_division_id_idx" ON "division_players"("division_id");

-- CreateIndex
CREATE UNIQUE INDEX "division_players_division_id_player_id_key" ON "division_players"("division_id", "player_id");

-- CreateIndex
CREATE INDEX "tournaments_event_category_id_idx" ON "tournaments"("event_category_id");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_event_category_id_fkey" FOREIGN KEY ("event_category_id") REFERENCES "event_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_category_teams" ADD CONSTRAINT "event_category_teams_event_category_id_fkey" FOREIGN KEY ("event_category_id") REFERENCES "event_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_category_teams" ADD CONSTRAINT "event_category_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineups" ADD CONSTRAINT "match_lineups_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineup_players" ADD CONSTRAINT "match_lineup_players_lineup_id_fkey" FOREIGN KEY ("lineup_id") REFERENCES "match_lineups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_lineup_players" ADD CONSTRAINT "match_lineup_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_rosters" ADD CONSTRAINT "category_rosters_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_rosters" ADD CONSTRAINT "category_rosters_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_rosters" ADD CONSTRAINT "category_rosters_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_officials" ADD CONSTRAINT "category_officials_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "category_officials" ADD CONSTRAINT "category_officials_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "event_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_divisions" ADD CONSTRAINT "team_divisions_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "division_players" ADD CONSTRAINT "division_players_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "team_divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "division_players" ADD CONSTRAINT "division_players_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
