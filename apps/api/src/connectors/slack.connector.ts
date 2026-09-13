import { Injectable, Logger } from "@nestjs/common";
import type { Connector, ConnectorDocument } from "./connector.interface";

/** Slack connector — MVP stub. Production: slack Web API conversations.history + events. */
@Injectable()
export class SlackConnector implements Connector {
  readonly type = "slack" as const;
  readonly name = "Slack";
  private readonly logger = new Logger(SlackConnector.name);

  async fetch(tenantId: string): Promise<ConnectorDocument[]> {
    this.logger.log(`Slack.fetch tenant=${tenantId} (stub)`);
    return [];
  }

  async health() {
    return { status: "ok" as const, latencyMs: 1 };
  }
}
