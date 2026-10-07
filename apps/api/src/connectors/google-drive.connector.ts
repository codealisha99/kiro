import { Injectable, Logger } from "@nestjs/common";
import type { Connector, ConnectorDocument } from "./connector.interface";

@Injectable()
export class GoogleDriveConnector implements Connector {
  readonly type = "google_drive" as const;
  readonly name = "Google Drive";
  private readonly logger = new Logger(GoogleDriveConnector.name);

  async fetch(tenantId: string): Promise<ConnectorDocument[]> {
    this.logger.log(`GoogleDrive.fetch tenant=${tenantId} (stub — no external call)`);
    return [];
  }

  async health() {
    return { status: "ok" as const, latencyMs: 1 };
  }
}
