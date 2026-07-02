-- AlterTable
ALTER TABLE "PlanningDraft" ADD COLUMN     "fallbackReason" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerAttempted" TEXT;
