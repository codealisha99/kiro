CREATE EXTENSION IF NOT EXISTS vector;

CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN');

CREATE TYPE "SourceType" AS ENUM ('GOOGLE_DRIVE', 'SLACK', 'CRM');

CREATE TYPE "SourceStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING');

CREATE TYPE "Classification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED');

CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE "PrincipalType" AS ENUM ('USER', 'ROLE', 'GROUP');

CREATE TYPE "Permission" AS ENUM ('READ', 'WRITE', 'ADMIN');

CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sources" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB,
    "status" "SourceStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "classification" "Classification" NOT NULL DEFAULT 'INTERNAL',
    "status" "DocumentStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_chunks" (
    "id" TEXT NOT NULL,
    "documentVersionId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "metadata" JSONB,

    CONSTRAINT "document_chunks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_acl" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "principalType" "PrincipalType" NOT NULL,
    "principalId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL DEFAULT 'READ',

    CONSTRAINT "document_acl_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "conversations" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "conversations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_requests" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_responses" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_responses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "response_evidence" (
    "id" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "chunkId" TEXT,
    "relevanceScore" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "response_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resourceId" TEXT,
    "query" TEXT,
    "retrievedSources" JSONB,
    "permissionDecision" TEXT,
    "model" TEXT,
    "responseId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

CREATE INDEX "sources_tenantId_idx" ON "sources"("tenantId");

CREATE INDEX "documents_tenantId_idx" ON "documents"("tenantId");

CREATE INDEX "documents_sourceId_idx" ON "documents"("sourceId");

CREATE INDEX "document_versions_documentId_idx" ON "document_versions"("documentId");

CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "document_versions"("documentId", "version");

CREATE INDEX "document_chunks_documentVersionId_idx" ON "document_chunks"("documentVersionId");

CREATE UNIQUE INDEX "document_acl_documentId_principalType_principalId_key" ON "document_acl"("documentId", "principalType", "principalId");

CREATE INDEX "conversations_tenantId_userId_idx" ON "conversations"("tenantId", "userId");

CREATE INDEX "ai_requests_tenantId_idx" ON "ai_requests"("tenantId");

CREATE INDEX "ai_requests_conversationId_idx" ON "ai_requests"("conversationId");

CREATE INDEX "ai_responses_requestId_idx" ON "ai_responses"("requestId");

CREATE INDEX "response_evidence_responseId_idx" ON "response_evidence"("responseId");

CREATE INDEX "response_evidence_versionId_idx" ON "response_evidence"("versionId");

CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");

ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "documents" ADD CONSTRAINT "documents_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_documentVersionId_fkey" FOREIGN KEY ("documentVersionId") REFERENCES "document_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_acl" ADD CONSTRAINT "document_acl_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ai_responses" ADD CONSTRAINT "ai_responses_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ai_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "response_evidence" ADD CONSTRAINT "response_evidence_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "ai_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "response_evidence" ADD CONSTRAINT "response_evidence_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "response_evidence" ADD CONSTRAINT "response_evidence_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "document_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
