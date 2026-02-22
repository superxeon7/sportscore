-- Make homeTeamId and awayTeamId nullable (for BYE/TBD bracket slots)
ALTER TABLE "matches" ALTER COLUMN "home_team_id" DROP NOT NULL;
ALTER TABLE "matches" ALTER COLUMN "away_team_id" DROP NOT NULL;

-- Add isBye flag for BYE bracket slots
ALTER TABLE "matches" ADD COLUMN "is_bye" BOOLEAN NOT NULL DEFAULT FALSE;
