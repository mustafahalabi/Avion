-- CreateIndex
CREATE UNIQUE INDEX "Workspace_companyId_id_key" ON "Workspace"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_companyId_id_key" ON "Employee"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "RuntimeRequest_companyId_id_key" ON "RuntimeRequest"("companyId", "id");

-- CreateTable
CREATE TABLE "Outcome" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "runtimeRequestId" TEXT,
    "title" TEXT NOT NULL,
    "rawRequest" TEXT NOT NULL,
    "brief" TEXT,
    "businessValue" TEXT,
    "successCriteria" TEXT NOT NULL DEFAULT '[]',
    "constraints" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "ownerRole" TEXT,
    "failureReason" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Outcome_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Outcome_companyId_runtimeRequestId_fkey" FOREIGN KEY ("companyId", "runtimeRequestId") REFERENCES "RuntimeRequest" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_runtimeRequestId_key" ON "Outcome"("runtimeRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_companyId_id_key" ON "Outcome"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Outcome_companyId_runtimeRequestId_key" ON "Outcome"("companyId", "runtimeRequestId");

-- CreateTable
CREATE TABLE "PlanningDraft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "outcomeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "version" INTEGER NOT NULL DEFAULT 1,
    "scope" TEXT NOT NULL DEFAULT '[]',
    "nonScope" TEXT NOT NULL DEFAULT '[]',
    "assumptions" TEXT NOT NULL DEFAULT '[]',
    "risks" TEXT NOT NULL DEFAULT '[]',
    "dependencies" TEXT NOT NULL DEFAULT '[]',
    "recommendedAssignments" TEXT NOT NULL DEFAULT '[]',
    "generatedProjects" TEXT NOT NULL DEFAULT '[]',
    "generatedFeatures" TEXT NOT NULL DEFAULT '[]',
    "generatedTasks" TEXT NOT NULL DEFAULT '[]',
    "reviewPlan" TEXT NOT NULL DEFAULT '{}',
    "qaPlan" TEXT NOT NULL DEFAULT '{}',
    "releasePlan" TEXT NOT NULL DEFAULT '{}',
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "generationError" TEXT,
    "applicationError" TEXT,
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "rejectedAt" DATETIME,
    "rejectedById" TEXT,
    "appliedAt" DATETIME,
    "appliedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlanningDraft_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlanningDraft_companyId_outcomeId_fkey" FOREIGN KEY ("companyId", "outcomeId") REFERENCES "Outcome" ("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanningDraft_outcomeId_version_key" ON "PlanningDraft"("outcomeId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningDraft_companyId_id_key" ON "PlanningDraft"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "PlanningDraft_companyId_outcomeId_version_key" ON "PlanningDraft"("companyId", "outcomeId", "version");

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "outcomeId" TEXT,
    "planningDraftId" TEXT,
    "planItemId" TEXT,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "startDate" DATETIME,
    "endDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_companyId_workspaceId_fkey" FOREIGN KEY ("companyId", "workspaceId") REFERENCES "Workspace" ("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_companyId_outcomeId_fkey" FOREIGN KEY ("companyId", "outcomeId") REFERENCES "Outcome" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Project_companyId_planningDraftId_fkey" FOREIGN KEY ("companyId", "planningDraftId") REFERENCES "PlanningDraft" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("companyId", "createdAt", "description", "endDate", "id", "name", "slug", "startDate", "status", "updatedAt", "workspaceId")
SELECT (
    SELECT "Workspace"."companyId"
    FROM "Workspace"
    WHERE "Workspace"."id" = "Project"."workspaceId"
), "createdAt", "description", "endDate", "id", "name", "slug", "startDate", "status", "updatedAt", "workspaceId" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
CREATE UNIQUE INDEX "Project_companyId_id_key" ON "Project"("companyId", "id");
CREATE UNIQUE INDEX "Project_planningDraftId_planItemId_key" ON "Project"("planningDraftId", "planItemId");

CREATE TABLE "new_Feature" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "outcomeId" TEXT,
    "planningDraftId" TEXT,
    "planItemId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Feature_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Feature_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "Project" ("companyId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Feature_companyId_outcomeId_fkey" FOREIGN KEY ("companyId", "outcomeId") REFERENCES "Outcome" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Feature_companyId_planningDraftId_fkey" FOREIGN KEY ("companyId", "planningDraftId") REFERENCES "PlanningDraft" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Feature" ("companyId", "createdAt", "description", "id", "priority", "projectId", "status", "title", "updatedAt")
SELECT (
    SELECT "Project"."companyId"
    FROM "Project"
    WHERE "Project"."id" = "Feature"."projectId"
), "createdAt", "description", "id", "priority", "projectId", "status", "title", "updatedAt" FROM "Feature";
DROP TABLE "Feature";
ALTER TABLE "new_Feature" RENAME TO "Feature";
CREATE UNIQUE INDEX "Feature_companyId_id_key" ON "Feature"("companyId", "id");
CREATE UNIQUE INDEX "Feature_planningDraftId_planItemId_key" ON "Feature"("planningDraftId", "planItemId");

CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "companyId" TEXT NOT NULL,
    "projectId" TEXT,
    "featureId" TEXT,
    "sprintId" TEXT,
    "assigneeId" TEXT,
    "outcomeId" TEXT,
    "planningDraftId" TEXT,
    "planItemId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "estimate" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_companyId_projectId_fkey" FOREIGN KEY ("companyId", "projectId") REFERENCES "Project" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_companyId_featureId_fkey" FOREIGN KEY ("companyId", "featureId") REFERENCES "Feature" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "Sprint" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_companyId_assigneeId_fkey" FOREIGN KEY ("companyId", "assigneeId") REFERENCES "Employee" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_companyId_outcomeId_fkey" FOREIGN KEY ("companyId", "outcomeId") REFERENCES "Outcome" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_companyId_planningDraftId_fkey" FOREIGN KEY ("companyId", "planningDraftId") REFERENCES "PlanningDraft" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("assigneeId", "companyId", "createdAt", "description", "estimate", "featureId", "id", "priority", "projectId", "sprintId", "status", "title", "updatedAt")
SELECT "assigneeId", COALESCE((
    SELECT "Project"."companyId"
    FROM "Project"
    WHERE "Project"."id" = "Task"."projectId"
), (
    SELECT "Feature"."companyId"
    FROM "Feature"
    WHERE "Feature"."id" = "Task"."featureId"
), "companyId"), "createdAt", "description", "estimate", "featureId", "id", "priority", "projectId", "sprintId", "status", "title", "updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
CREATE UNIQUE INDEX "Task_companyId_id_key" ON "Task"("companyId", "id");
CREATE UNIQUE INDEX "Task_planningDraftId_planItemId_key" ON "Task"("planningDraftId", "planItemId");

CREATE TABLE "new_Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'task',
    "entityId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "outcomeId" TEXT,
    "planningDraftId" TEXT,
    "planItemId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "verdict" TEXT,
    "notes" TEXT,
    "changeRequestNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Review_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Review_companyId_outcomeId_fkey" FOREIGN KEY ("companyId", "outcomeId") REFERENCES "Outcome" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Review_companyId_planningDraftId_fkey" FOREIGN KEY ("companyId", "planningDraftId") REFERENCES "PlanningDraft" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Review" ("changeRequestNotes", "companyId", "createdAt", "entityId", "entityType", "id", "notes", "reviewerId", "status", "title", "updatedAt", "verdict")
SELECT "changeRequestNotes", "companyId", "createdAt", "entityId", "entityType", "id", "notes", "reviewerId", "status", "title", "updatedAt", "verdict" FROM "Review";
DROP TABLE "Review";
ALTER TABLE "new_Review" RENAME TO "Review";
CREATE UNIQUE INDEX "Review_planningDraftId_planItemId_key" ON "Review"("planningDraftId", "planItemId");

CREATE TABLE "new_QAResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'task',
    "entityId" TEXT NOT NULL,
    "outcomeId" TEXT,
    "planningDraftId" TEXT,
    "planItemId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "passedCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "checks" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "QAResult_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "QAResult_companyId_outcomeId_fkey" FOREIGN KEY ("companyId", "outcomeId") REFERENCES "Outcome" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "QAResult_companyId_planningDraftId_fkey" FOREIGN KEY ("companyId", "planningDraftId") REFERENCES "PlanningDraft" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_QAResult" ("checks", "companyId", "createdAt", "entityId", "entityType", "failedCount", "id", "notes", "passedCount", "status", "updatedAt")
SELECT "checks", "companyId", "createdAt", "entityId", "entityType", "failedCount", "id", "notes", "passedCount", "status", "updatedAt" FROM "QAResult";
DROP TABLE "QAResult";
ALTER TABLE "new_QAResult" RENAME TO "QAResult";
CREATE UNIQUE INDEX "QAResult_planningDraftId_planItemId_key" ON "QAResult"("planningDraftId", "planItemId");

CREATE TABLE "new_Release" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "outcomeId" TEXT,
    "planningDraftId" TEXT,
    "planItemId" TEXT,
    "version" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "releaseNotes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "deploymentStatus" TEXT NOT NULL DEFAULT 'not_started',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "taskIds" TEXT NOT NULL DEFAULT '[]',
    "rollbackPlan" TEXT,
    "postReleaseNotes" TEXT,
    "releasedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Release_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Release_companyId_outcomeId_fkey" FOREIGN KEY ("companyId", "outcomeId") REFERENCES "Outcome" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Release_companyId_planningDraftId_fkey" FOREIGN KEY ("companyId", "planningDraftId") REFERENCES "PlanningDraft" ("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Release" ("checklist", "companyId", "createdAt", "deploymentStatus", "description", "id", "postReleaseNotes", "releaseNotes", "releasedAt", "rollbackPlan", "status", "taskIds", "title", "updatedAt", "version")
SELECT "checklist", "companyId", "createdAt", "deploymentStatus", "description", "id", "postReleaseNotes", "releaseNotes", "releasedAt", "rollbackPlan", "status", "taskIds", "title", "updatedAt", "version" FROM "Release";
DROP TABLE "Release";
ALTER TABLE "new_Release" RENAME TO "Release";
CREATE UNIQUE INDEX "Release_planningDraftId_planItemId_key" ON "Release"("planningDraftId", "planItemId");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
