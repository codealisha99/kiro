-- AlterTable
ALTER TABLE "document_versions" ADD COLUMN "content" TEXT;
ALTER TABLE "document_versions" ADD COLUMN "filename" TEXT;

-- AlterTable
ALTER TABLE "ai_responses" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'answered';
