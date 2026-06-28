-- CreateTable
CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "userId" TEXT,
    "provider" TEXT NOT NULL,
    "connectionType" TEXT NOT NULL DEFAULT 'oauth',
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "externalAccountId" TEXT,
    "externalAccountName" TEXT,
    "externalAccountEmail" TEXT,
    "scopes" TEXT NOT NULL DEFAULT '[]',
    "encryptedTokens" TEXT NOT NULL DEFAULT '{}',
    "tokenExpiresAt" DATETIME,
    "refreshAvailable" BOOLEAN NOT NULL DEFAULT false,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "lastConnectedAt" DATETIME,
    "disconnectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProviderConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ProviderConnection_companyId_provider_userId_key" ON "ProviderConnection"("companyId", "provider", "userId");

-- CreateIndex
CREATE INDEX "ProviderConnection_companyId_provider_idx" ON "ProviderConnection"("companyId", "provider");

-- CreateIndex
CREATE INDEX "ProviderConnection_companyId_status_idx" ON "ProviderConnection"("companyId", "status");
