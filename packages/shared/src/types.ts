import type {
  ApprovalStatus,
  Classification,
  DocumentStatus,
  Permission,
  RBACRole,
} from "./constants";

export interface Tenant {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  tenantId: string;
  email: string;
  name: string | null;
  role: RBACRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface PermissionAssignment {
  id: string;
  tenantId: string;
  userId: string;
  scope: string;
  permission: Permission;
  createdAt: Date;
}

// ---- Knowledge object model (PRD section 8) ----

export interface Document {
  id: string;
  tenantId: string;
  sourceId: string;
  externalId: string;
  title: string;
  ownerId: string;
  classification: Classification;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  version: number;
  contentHash: string;
  createdAt: Date;
  approvalStatus: ApprovalStatus;
}

export interface DocumentChunk {
  id: string;
  documentVersionId: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
}

export interface DocumentACL {
  documentId: string;
  principalType: "user" | "role" | "group";
  principalId: string;
  permission: Permission;
}

// ---- Query data model (PRD section 9) ----

export interface AIRequest {
  id: string;
  tenantId: string;
  userId: string;
  conversationId: string;
  query: string;
  createdAt: Date;
}

export interface AIResponse {
  id: string;
  requestId: string;
  answer: string;
  model: string;
  modelVersion: string;
  confidence: number;
  createdAt: Date;
}

export interface ResponseEvidence {
  responseId: string;
  documentId: string;
  versionId: string;
  chunkId: string;
  relevanceScore: number;
}
