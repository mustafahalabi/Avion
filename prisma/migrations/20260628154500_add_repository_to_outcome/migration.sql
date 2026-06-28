-- AlterTable
ALTER TABLE "Outcome" ADD COLUMN "repositoryId" TEXT;

-- AddForeignKey
ALTER TABLE "Outcome" ADD CONSTRAINT "Outcome_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE SET NULL ON UPDATE CASCADE;
