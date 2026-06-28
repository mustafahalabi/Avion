-- CreateTable
CREATE TABLE "ExecutionSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "taskId" TEXT,
    "projectId" TEXT,
    "repositoryId" TEXT,
    "employeeId" TEXT,
    "planningDraftId" TEXT,
    "agentType" TEXT NOT NULL DEFAULT 'claude_code',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "taskBrief" TEXT,
    "resultSummary" TEXT,
    "filesChanged" TEXT NOT NULL DEFAULT '[]',
    "validationOutput" TEXT,
    "errorMessage" TEXT,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExecutionSession_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExecutionSession_companyId_taskId_fkey" FOREIGN KEY ("companyId", "taskId") REFERENCES "Task" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExecutionSession_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "Project" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExecutionSession_companyId_employeeId_fkey" FOREIGN KEY ("companyId", "employeeId") REFERENCES "Employee" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExecutionSession_companyId_planningDraftId_fkey" FOREIGN KEY ("companyId", "planningDraftId") REFERENCES "PlanningDraft" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ExecutionSession_repositoryId_fkey" FOREIGN KEY ("repositoryId") REFERENCES "Repository" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExecutionSession_companyId_status_idx" ON "ExecutionSession"("companyId", "status");

-- CreateIndex
CREATE INDEX "ExecutionSession_companyId_taskId_idx" ON "ExecutionSession"("companyId", "taskId");
