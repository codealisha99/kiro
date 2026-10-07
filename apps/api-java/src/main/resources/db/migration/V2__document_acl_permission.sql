ALTER TABLE "document_acl"
  ADD COLUMN IF NOT EXISTS "permission" "Permission" NOT NULL DEFAULT 'READ';
