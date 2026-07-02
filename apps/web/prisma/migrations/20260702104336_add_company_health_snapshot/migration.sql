-- CreateTable
CREATE TABLE "CompanyHealthSnapshot" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dayKey" TEXT NOT NULL,
    "tasksDoneTotal" INTEGER NOT NULL,
    "tasksDone7d" INTEGER NOT NULL,
    "tasksBlocked" INTEGER NOT NULL,
    "changeRequestsTotal" INTEGER NOT NULL,
    "changeRequestsUnresolved" INTEGER NOT NULL,
    "reworkRatePerDoneTask" DOUBLE PRECISION,
    "retriesExhausted7d" INTEGER NOT NULL,
    "qaResultsWithChecks7d" INTEGER NOT NULL,
    "qaPassedWithChecks7d" INTEGER NOT NULL,
    "qaPassRate7d" DOUBLE PRECISION,
    "prsMerged7d" INTEGER NOT NULL,
    "prFeedbackReviews7d" INTEGER NOT NULL,
    "prCiFailures7d" INTEGER NOT NULL,
    "memoryRecords7d" INTEGER NOT NULL,
    "memoryRecordsTotal" INTEGER NOT NULL,
    "standardsPromoted7d" INTEGER NOT NULL,
    "standardsTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyHealthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyHealthSnapshot_companyId_capturedAt_idx" ON "CompanyHealthSnapshot"("companyId", "capturedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyHealthSnapshot_companyId_dayKey_key" ON "CompanyHealthSnapshot"("companyId", "dayKey");

-- AddForeignKey
ALTER TABLE "CompanyHealthSnapshot" ADD CONSTRAINT "CompanyHealthSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

