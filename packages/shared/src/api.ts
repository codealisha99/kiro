import type { Classification, DocumentStatus, Permission } from "./constants";

// ---- Sources ----

export type SourceType = "google_drive" | "slack" | "crm" | "manual";
export type SourceStatusName = "connected" | "disconnected" | "error" | "syncing";

export interface SourceDto {
  id: string;
  tenantId: string;
  type: SourceType;
  name: string;
  status: SourceStatusName;
  lastSyncAt: Date | null;
  createdAt: Date;
  documentCount: number;
}

export interface CreateSourceRequest {
  type: SourceType;
  name: string;
}

// ---- Documents ----

export interface DocumentVersionDto {
  id: string;
  version: number;
  contentHash: string;
  filename: string | null;
  createdAt: Date;
}

export interface DocumentListItem {
  id: string;
  sourceId: string;
  title: string;
  classification: Classification;
  status: DocumentStatus;
  updatedAt: Date;
  versionCount: number;
}

export interface DocumentChunkPreview {
  id: string;
  index: number;
  content: string;
}

export interface DocumentDetail extends DocumentListItem {
  versions: DocumentVersionDto[];
  content: string;
  filename: string | null;
  chunks: DocumentChunkPreview[];
}

export interface IngestDocumentRequest {
  title: string;
  content: string;
  classification?: Classification;
  /** ACL grants on top of the owner's implicit access. */
  acl?: IngestAclGrant[];
}

export interface IngestDocumentResponse {
  id: string;
  title: string;
  sourceId: string;
  classification: Classification;
  version: number;
  created: boolean;
  contentChanged: boolean;
}

export interface DemoSeedResponse {
  seeded: boolean;
  documentCount: number;
  sourceName: string;
  viewer?: {
    email: string;
    password: string;
    role: string;
  };
}

export interface IngestAclGrant {
  principalType: "user" | "role" | "group";
  principalId: string;
  permission?: Permission;
}

// ---- Conversations ----

export interface ConversationDto {
  id: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateConversationRequest {
  title?: string;
}

export interface ConversationMessageDto {
  id: string;
  query: string;
  answer: string;
  status: AnswerStatus;
  createdAt: Date;
  sources: CitationSource[];
}

export interface ConversationDetail extends ConversationDto {
  messages: ConversationMessageDto[];
}

// ---- Brain query ----

export interface BrainQueryRequest {
  query: string;
  conversationId?: string;
}

export type AnswerStatus = "answered" | "unknown" | "ambiguous" | "partial" | "error";

export interface CitationSource {
  documentId: string;
  chunkId?: string;
  title: string;
  sourceName: string;
  version: number;
  score: number;
  excerpt: string;
  updatedAt: Date | null;
  classification: Classification;
}

export interface BrainQueryResponse {
  requestId: string;
  conversationId: string;
  question: string;
  answer: string;
  status: AnswerStatus;
  confidence: number;
  sources: CitationSource[];
  message?: string;
}

// ---- Feedback ----

export interface FeedbackRequest {
  requestId: string;
  helpful: boolean;
  comment?: string;
}

// ---- Admin ----

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  query: string | null;
  permissionDecision: string | null;
  model: string | null;
  error: string | null;
  createdAt: Date;
}