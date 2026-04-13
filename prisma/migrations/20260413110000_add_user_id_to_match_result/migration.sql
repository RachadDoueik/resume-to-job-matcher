-- AddColumn
ALTER TABLE "MatchResult" ADD COLUMN "userId" TEXT NOT NULL DEFAULT '';

-- Backfill ownership from existing resumes.
UPDATE "MatchResult" AS mr
SET "userId" = r."userId"
FROM "Resume" AS r
WHERE mr."resumeId" = r."id";

-- Remove default so new rows must explicitly provide ownership.
ALTER TABLE "MatchResult" ALTER COLUMN "userId" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "MatchResult_userId_resumeId_createdAt_idx"
ON "MatchResult"("userId", "resumeId", "createdAt");
