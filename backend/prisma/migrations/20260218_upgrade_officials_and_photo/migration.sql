-- 1a. Create team_officials table
CREATE TABLE team_officials (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  full_name VARCHAR(100) NOT NULL,
  date_of_birth TIMESTAMP(3),
  place_of_birth VARCHAR(200),
  nationality VARCHAR(100),
  role "OfficialRole" NOT NULL,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(3) NOT NULL
);
CREATE INDEX idx_team_officials_team_id ON team_officials(team_id);

-- 1b. Migrate existing category_officials data into team_officials
INSERT INTO team_officials (id, team_id, full_name, role, photo_url, created_at, updated_at)
SELECT id, team_id, name, role, photo_url, created_at, updated_at
FROM category_officials
ON CONFLICT (id) DO NOTHING;

-- 1c. Create match_officials table
CREATE TABLE match_officials (
  id TEXT PRIMARY KEY,
  match_id TEXT NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  official_id TEXT NOT NULL REFERENCES team_officials(id) ON DELETE CASCADE,
  is_head_coach BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX idx_match_officials_unique ON match_officials(match_id, team_id, official_id);
CREATE INDEX idx_match_officials_match_id ON match_officials(match_id);
CREATE INDEX idx_match_officials_team_id ON match_officials(team_id);

-- 1d. Rename Player avatar_url -> photo_url
ALTER TABLE players RENAME COLUMN avatar_url TO photo_url;
