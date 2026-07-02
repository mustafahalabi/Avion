-- Drop dead / write-only schema (MUS-298): the Knowledge/KnowledgeRecord (real
-- store is Memory), Event (dup of TimelineEntry), Incident, and write-only
-- IntegrationSyncLog models, plus the never-consumed CompanySettings
-- timezone/currency/locale columns. All were 0-read (or write-only).

-- DropForeignKey
ALTER TABLE "IntegrationSyncLog" DROP CONSTRAINT "IntegrationSyncLog_integrationId_fkey";
-- DropForeignKey
ALTER TABLE "KnowledgeRecord" DROP CONSTRAINT "KnowledgeRecord_knowledgeId_fkey";
-- AlterTable
ALTER TABLE "CompanySettings" DROP COLUMN "currency",
DROP COLUMN "locale",
DROP COLUMN "timezone";
-- DropTable
DROP TABLE "Event";
-- DropTable
DROP TABLE "Incident";
-- DropTable
DROP TABLE "IntegrationSyncLog";
-- DropTable
DROP TABLE "Knowledge";
-- DropTable
DROP TABLE "KnowledgeRecord";
