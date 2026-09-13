import { Injectable, Logger } from "@nestjs/common";
import type { Connector } from "./connector.interface";

/** CRM connector — MVP stub. Production: Salesforce/HubSpot REST + webhooks. */
@Injectable()
export class CrmConnector implements Connector {
  readonly type = "crm" as const;
  readonly name = "CRM";
  private readonly logger = new Logger(CrmConnector.name);

  async fetch(tenantId: string) {
    this.logger.log(`CRM.fetch tenant=${tenantId} (stub)`);
    return [];
  }

  async health() {
    return { status: "ok" as const, latencyMs: 1 };
  }
}
