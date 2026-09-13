export interface ConnectorDocument {
  externalId: string;
  title: string;
  content: string;
  mimeType?: string;
  acl?: { principalType: string; principalId: string; permission?: string }[];
}

export interface Connector {
  readonly type: "google_drive" | "slack" | "crm";
  readonly name: string;
  /** Fetch documents from the source — MVP stubs return demo data or empty. */
  fetch(tenantId: string, config?: Record<string, unknown>): Promise<ConnectorDocument[]>;
  /** Health check for admin dashboard */
  health?(): Promise<{ status: "ok" | "error"; latencyMs: number }>;
}
