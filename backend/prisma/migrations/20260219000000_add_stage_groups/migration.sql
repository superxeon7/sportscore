-- CreateTable
CREATE TABLE "stage_groups" (
    "id" TEXT NOT NULL,
    "category_stage_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stage_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stage_group_teams" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stage_group_teams_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stage_groups_category_stage_id_idx" ON "stage_groups"("category_stage_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_groups_category_stage_id_name_key" ON "stage_groups"("category_stage_id", "name");

-- CreateIndex
CREATE INDEX "stage_group_teams_group_id_idx" ON "stage_group_teams"("group_id");

-- CreateIndex
CREATE UNIQUE INDEX "stage_group_teams_group_id_team_id_key" ON "stage_group_teams"("group_id", "team_id");

-- AddForeignKey
ALTER TABLE "stage_groups" ADD CONSTRAINT "stage_groups_category_stage_id_fkey" FOREIGN KEY ("category_stage_id") REFERENCES "category_stages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_group_teams" ADD CONSTRAINT "stage_group_teams_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "stage_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stage_group_teams" ADD CONSTRAINT "stage_group_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
