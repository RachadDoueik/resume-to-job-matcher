-- CreateTable
CREATE TABLE "MatchResult" (
    "id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "matchedSkills" TEXT[],
    "missingSkills" TEXT[],
    "summary" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OptimizationResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "resumeId" TEXT NOT NULL,
    "projectIdeas" JSONB NOT NULL,
    "certifications" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OptimizationResult_pkey" PRIMARY KEY ("id")
);
