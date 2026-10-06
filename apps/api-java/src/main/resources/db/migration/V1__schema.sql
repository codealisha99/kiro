-- Kiro baseline schema — port of apps/api/prisma/migrations/* (consolidated).
-- Quoted camelCase identifiers match the Prisma-created database exactly so the
-- Java backend works against both fresh and existing (NestJS-created) databases.
-- Two deliberate fixes vs Prisma: users UNIQUE(tenantId,email) (was global email),
-- plus an HNSW index on document_chunks.embedding.

CREATE EXTENSION IF NOT EXISTS vector;

DO $$ BEGIN CREATE TYPE "Role" AS ENUM ('EMPLOYEE', 'MANAGER', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SourceType" AS ENUM ('GOOGLE_DRIVE', 'SLACK', 'CRM', 'MANUAL'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "SourceStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR', 'SYNCING'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Classification" AS ENUM ('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'RESTRICTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "PrincipalType" AS ENUM ('USER', 'ROLE', 'GROUP'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE "Permission" AS ENUM ('READ', 'WRITE', 'ADMIN'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "Tenant" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"),
  "email" TEXT NOT NULL,
  "name" TEXT,
  "password" TEXT,
  "role" "Role" NOT NULL DEFAULT 'EMPLOYEE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "users_tenantId_idx" ON "users"("tenantId");
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenantId_email_key" ON "users"("tenantId", "email");

CREATE TABLE IF NOT EXISTS "sessions" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "sessions_userId_idx" ON "sessions"("userId");

CREATE TABLE IF NOT EXISTS "sources" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "type" "SourceType" NOT NULL,
  "name" TEXT NOT NULL,
  "config" JSONB,
  "status" "SourceStatus" NOT NULL DEFAULT 'DISCONNECTED',
  "lastSyncAt" TIMESTAMP(3),
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "sources_tenantId_idx" ON "sources"("tenantId");
CREATE INDEX IF NOT EXISTS "sources_tenantId_deleted_idx" ON "sources"("tenantId", "deleted");

CREATE TABLE IF NOT EXISTS "documents" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "sourceId" TEXT NOT NULL REFERENCES "sources"("id"),
  "externalId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "classification" "Classification" NOT NULL DEFAULT 'INTERNAL',
  "status" "DocumentStatus" NOT NULL DEFAULT 'PUBLISHED',
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("tenantId", "sourceId", "externalId")
);
CREATE INDEX IF NOT EXISTS "documents_tenantId_idx" ON "documents"("tenantId");
CREATE INDEX IF NOT EXISTS "documents_tenantId_deleted_idx" ON "documents"("tenantId", "deleted");
CREATE INDEX IF NOT EXISTS "documents_sourceId_idx" ON "documents"("sourceId");

CREATE TABLE IF NOT EXISTS "document_versions" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "version" INTEGER NOT NULL,
  "contentHash" TEXT NOT NULL,
  "content" TEXT,
  "filename" TEXT,
  "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("documentId", "version")
);
CREATE INDEX IF NOT EXISTS "document_versions_documentId_idx" ON "document_versions"("documentId");

CREATE TABLE IF NOT EXISTS "document_chunks" (
  "id" TEXT PRIMARY KEY,
  "documentVersionId" TEXT NOT NULL REFERENCES "document_versions"("id") ON DELETE CASCADE,
  "content" TEXT NOT NULL,
  "embedding" vector(1536),
  "metadata" JSONB
);
CREATE INDEX IF NOT EXISTS "document_chunks_documentVersionId_idx" ON "document_chunks"("documentVersionId");
CREATE INDEX IF NOT EXISTS "document_chunks_embedding_hnsw_idx"
  ON "document_chunks" USING hnsw ("embedding" vector_cosine_ops);

CREATE TABLE IF NOT EXISTS "document_acl" (
  "id" TEXT PRIMARY KEY,
  "documentId" TEXT NOT NULL REFERENCES "documents"("id") ON DELETE CASCADE,
  "principalType" "PrincipalType" NOT NULL,
  "principalId" TEXT NOT NULL,
  UNIQUE ("documentId", "principalType", "principalId")
);

CREATE TABLE IF NOT EXISTS "conversations" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "conversations_tenantId_userId_idx" ON "conversations"("tenantId", "userId");

CREATE TABLE IF NOT EXISTS "ai_requests" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL REFERENCES "conversations"("id") ON DELETE CASCADE,
  "query" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ai_requests_tenantId_idx" ON "ai_requests"("tenantId");
CREATE INDEX IF NOT EXISTS "ai_requests_conversationId_idx" ON "ai_requests"("conversationId");

CREATE TABLE IF NOT EXISTS "ai_responses" (
  "id" TEXT PRIMARY KEY,
  "requestId" TEXT NOT NULL REFERENCES "ai_requests"("id") ON DELETE CASCADE,
  "answer" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'answered',
  "model" TEXT NOT NULL,
  "modelVersion" TEXT NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "usage" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ai_responses_requestId_idx" ON "ai_responses"("requestId");

CREATE TABLE IF NOT EXISTS "response_evidence" (
  "id" TEXT PRIMARY KEY,
  "responseId" TEXT NOT NULL REFERENCES "ai_responses"("id") ON DELETE CASCADE,
  "documentId" TEXT NOT NULL REFERENCES "documents"("id"),
  "versionId" TEXT NOT NULL REFERENCES "document_versions"("id"),
  "chunkId" TEXT,
  "relevanceScore" DOUBLE PRECISION NOT NULL
);
CREATE INDEX IF NOT EXISTS "response_evidence_responseId_idx" ON "response_evidence"("responseId");
CREATE INDEX IF NOT EXISTS "response_evidence_versionId_idx" ON "response_evidence"("versionId");

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" TEXT PRIMARY KEY,
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
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");
CREATE INDEX IF NOT EXISTS "audit_logs_userId_idx" ON "audit_logs"("userId");

CREATE TABLE IF NOT EXISTS "feedback" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "helpful" BOOLEAN NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "feedback_tenantId_idx" ON "feedback"("tenantId");
CREATE INDEX IF NOT EXISTS "feedback_requestId_idx" ON "feedback"("requestId");
