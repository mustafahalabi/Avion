-- AlterTable
ALTER TABLE "CompanySettings" ADD COLUMN     "spendCeilingUsd" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "outcomeId" TEXT,
    "taskId" TEXT,
    "sessionId" TEXT,
    "phase" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedInputTokens" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageRecord_companyId_outcomeId_idx" ON "UsageRecord"("companyId", "outcomeId");

-- CreateIndex
CREATE INDEX "UsageRecord_companyId_createdAt_idx" ON "UsageRecord"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageRecord_sessionId_idx" ON "UsageRecord"("sessionId");
