-- Delete orphaned rows that cannot be tied to a resume owner.
DELETE FROM "MatchResult" AS mr
WHERE NOT EXISTS (
  SELECT 1
  FROM "Resume" AS r
  WHERE r."id" = mr."resumeId"
);

-- Backfill any legacy rows that still have an empty userId.
UPDATE "MatchResult" AS mr
SET "userId" = r."userId"
FROM "Resume" AS r
WHERE mr."resumeId" = r."id"
  AND mr."userId" = '';

-- AddForeignKey
ALTER TABLE "MatchResult"
ADD CONSTRAINT "MatchResult_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchResult"
ADD CONSTRAINT "MatchResult_resumeId_fkey"
FOREIGN KEY ("resumeId") REFERENCES "Resume"("id") ON DELETE CASCADE ON UPDATE CASCADE;
