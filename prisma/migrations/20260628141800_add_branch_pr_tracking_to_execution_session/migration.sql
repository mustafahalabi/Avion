-- AlterTable: add Git/PR tracking fields to ExecutionSession
ALTER TABLE "ExecutionSession" ADD COLUMN "branchName" TEXT;
ALTER TABLE "ExecutionSession" ADD COLUMN "baseBranch" TEXT;
ALTER TABLE "ExecutionSession" ADD COLUMN "commitSha" TEXT;
ALTER TABLE "ExecutionSession" ADD COLUMN "prUrl" TEXT;
ALTER TABLE "ExecutionSession" ADD COLUMN "prNumber" INTEGER;
ALTER TABLE "ExecutionSession" ADD COLUMN "prStatus" TEXT;
ALTER TABLE "ExecutionSession" ADD COLUMN "mergeStatus" TEXT;
