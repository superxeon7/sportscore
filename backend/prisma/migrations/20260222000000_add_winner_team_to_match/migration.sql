-- Add winner_team_id and penalty_winner_team_id to matches table
ALTER TABLE "matches" ADD COLUMN "winner_team_id" TEXT;
ALTER TABLE "matches" ADD COLUMN "penalty_winner_team_id" TEXT;

-- Foreign key constraints
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_team_id_fkey"
  FOREIGN KEY ("winner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "matches" ADD CONSTRAINT "matches_penalty_winner_team_id_fkey"
  FOREIGN KEY ("penalty_winner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Indices
CREATE INDEX "matches_winner_team_id_idx" ON "matches"("winner_team_id");
CREATE INDEX "matches_penalty_winner_team_id_idx" ON "matches"("penalty_winner_team_id");
