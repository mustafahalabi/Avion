-- CreateTable
CREATE TABLE "SessionLogChunk" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "seq" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "detail" TEXT,
    "atMs" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionLogChunk_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionLogChunk_sessionId_seq_idx" ON "SessionLogChunk"("sessionId", "seq");

-- CreateIndex
CREATE INDEX "SessionLogChunk_companyId_sessionId_idx" ON "SessionLogChunk"("companyId", "sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionLogChunk_sessionId_seq_key" ON "SessionLogChunk"("sessionId", "seq");

-- AddForeignKey
ALTER TABLE "SessionLogChunk" ADD CONSTRAINT "SessionLogChunk_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExecutionSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
