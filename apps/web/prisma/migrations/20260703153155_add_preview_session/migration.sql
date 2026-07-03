-- CreateTable
CREATE TABLE "PreviewSession" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "repositoryId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "desiredState" TEXT NOT NULL DEFAULT 'running',
    "branch" TEXT,
    "packageManager" TEXT,
    "command" TEXT,
    "port" INTEGER,
    "previewUrl" TEXT,
    "pid" INTEGER,
    "claimedByHost" TEXT,
    "envVars" TEXT,
    "logs" TEXT NOT NULL DEFAULT '',
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "lastHeartbeatAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreviewSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PreviewSession_companyId_status_idx" ON "PreviewSession"("companyId", "status");

-- CreateIndex
CREATE INDEX "PreviewSession_repositoryId_idx" ON "PreviewSession"("repositoryId");

-- CreateIndex
CREATE INDEX "PreviewSession_status_idx" ON "PreviewSession"("status");

-- AddForeignKey
ALTER TABLE "PreviewSession" ADD CONSTRAINT "PreviewSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewSession" ADD CONSTRAINT "PreviewSession_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreviewSession" ADD CONSTRAINT "PreviewSession_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository"("id") ON DELETE CASCADE ON UPDATE CASCADE;
