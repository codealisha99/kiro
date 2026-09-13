import { Injectable } from "@nestjs/common";
import { GoogleDriveConnector } from "./google-drive.connector";
import { SlackConnector } from "./slack.connector";
import { CrmConnector } from "./crm.connector";
import { PrismaService } from "../prisma/prisma.service";
import { IngestionService } from "../ingestion/ingestion.service";

@Injectable()
export class ConnectorsService {
  constructor(
    private readonly drive: GoogleDriveConnector,
    private readonly slack: SlackConnector,
    private readonly crm: CrmConnector,
    private readonly prisma: PrismaService,
    private readonly ingestion: IngestionService,
  ) {}

  private forType(type: string) {
    const t = type.toLowerCase();
    if (t === "google_drive") return this.drive;
    if (t === "slack") return this.slack;
    if (t === "crm") return this.crm;
    return null;
  }

  /** Trigger a sync for a source — MVP: fetch stub + ingest + update lastSyncAt */
  async sync(tenantId: string, sourceId: string, user: { id: string; tenantId: string; role: string }) {
    const source = await this.prisma.source.findFirst({ where: { id: sourceId, tenantId, deleted: false } });
    if (!source) throw new Error("Source not found");
    const connector = this.forType(source.type);
    if (!connector) return { synced: 0 };
    const docs = await connector.fetch(tenantId);
    let synced = 0;
    for (const d of docs) {
      const authUser = user as any;
      await this.ingestion.ingestManualDocument(authUser, {
        title: d.title,
        content: d.content,
        sourceName: source.name,
        externalId: `${source.type}:${d.externalId}`,
        acl: d.acl,
      });
      synced++;
    }
    await this.prisma.source.update({ where: { id: sourceId }, data: { lastSyncAt: new Date(), status: "CONNECTED" } });
    return { synced };
  }

  async healthAll() {
    const [drive, slack, crm] = await Promise.all([this.drive.health(), this.slack.health(), this.crm.health()]);
    return { google_drive: drive, slack, crm };
  }
}
