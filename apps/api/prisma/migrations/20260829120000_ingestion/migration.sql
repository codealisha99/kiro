ALTER TYPE "SourceType" ADD VALUE 'MANUAL';

ALTER TABLE "sources" ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "documents" ADD COLUMN "deleted" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "sources_tenantId_deleted_idx" ON "sources"("tenantId", "deleted");
CREATE INDEX "documents_tenantId_deleted_idx" ON "documents"("tenantId", "deleted");

CREATE UNIQUE INDEX "documents_tenantId_sourceId_externalId_key"
  ON "documents"("tenantId", "sourceId", "externalId");

CREATE TABLE "feedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "feedback_tenantId_idx" ON "feedback"("tenantId");
CREATE INDEX "feedback_requestId_idx" ON "feedback"("requestId");
