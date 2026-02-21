-- AlterEnum
ALTER TYPE "StageType" ADD VALUE 'SPECIAL_GROUP';

-- AlterTable: category_stages
ALTER TABLE "category_stages" ADD COLUMN "match_per_team" INTEGER,
ADD COLUMN "penalty_enabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: matches
ALTER TABLE "matches" ADD COLUMN "home_penalty_score" INTEGER,
ADD COLUMN "away_penalty_score" INTEGER,
ADD COLUMN "is_penalty_used" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable: standings
ALTER TABLE "standings" ADD COLUMN "penalty_wins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "penalty_losses" INTEGER NOT NULL DEFAULT 0;
