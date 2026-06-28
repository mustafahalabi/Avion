-- CreateTable
CREATE TABLE "RepositoryAnalysisSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "repositoryId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "analyzerVersion" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "error" TEXT,
    "localPath" TEXT,
    "fileTree" TEXT NOT NULL DEFAULT '{}',
    "importantFiles" TEXT NOT NULL DEFAULT '[]',
    "routes" TEXT NOT NULL DEFAULT '[]',
    "apiRoutes" TEXT NOT NULL DEFAULT '[]',
    "serverActions" TEXT NOT NULL DEFAULT '[]',
    "prismaModels" TEXT NOT NULL DEFAULT '[]',
    "dependencies" TEXT NOT NULL DEFAULT '[]',
    "devDependencies" TEXT NOT NULL DEFAULT '[]',
    "scripts" TEXT NOT NULL DEFAULT '{}',
    "testFiles" TEXT NOT NULL DEFAULT '[]',
    "fileFingerprints" TEXT NOT NULL DEFAULT '[]',
    "risks" TEXT NOT NULL DEFAULT '[]',
    "ignoredPaths" TEXT NOT NULL DEFAULT '[]',
    "analysisSummary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RepositoryAnalysisSnapshot_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RepositoryAnalysisSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RepositoryAnalysisSnapshot_repositoryId_createdAt_idx" ON "RepositoryAnalysisSnapshot"("repositoryId", "createdAt");

-- CreateIndex
CREATE INDEX "RepositoryAnalysisSnapshot_companyId_createdAt_idx" ON "RepositoryAnalysisSnapshot"("companyId", "createdAt");
