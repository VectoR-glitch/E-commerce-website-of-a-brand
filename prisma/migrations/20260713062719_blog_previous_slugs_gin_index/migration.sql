-- CreateIndex
CREATE INDEX "BlogPost_previousSlugs_idx" ON "BlogPost" USING GIN ("previousSlugs" array_ops);
