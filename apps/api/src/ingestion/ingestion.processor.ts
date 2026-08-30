import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import type { IngestJob } from "./ingestion.queue";

const EMBED_BATCH_SIZE = 24;

/** Runs the async half of ingestion: embedding stored chunks into pgvector. */
@Injectable()
export class IngestionProcessor {
  private readonly logger = new Logger(IngestionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiGatewayService,
  ) {}

  async handle(job: IngestJob) {
    if (job.name === "embed-version") {
      await this.embedVersion(job.data.versionId);
      return;
    }
    throw new Error(`Unknown ingestion job type: ${job.name}`);
  }

  async embedVersion(versionId: string) {
    const rows = await this.prisma.$queryRaw<{ id: string; content: string }[]>`
      SELECT "id", "content"
      FROM "document_chunks"
      WHERE "documentVersionId" = ${versionId}
        AND "embedding" IS NULL
      ORDER BY "id" ASC
    `;

    // Keyword search already covers these; nothing to embed.
    if (rows.length === 0) {
      return { embedded: 0 };
    }

    let embedded = 0;
    for (let i = 0; i < rows.length; i += EMBED_BATCH_SIZE) {
      const batch = rows.slice(i, i + EMBED_BATCH_SIZE);
      const { embeddings } = await this.ai.embedTexts(batch.map((c) => c.content));

      for (let j = 0; j < batch.length; j++) {
        const vector = embeddings[j];
        if (!vector) {
          continue;
        }
        const sqlVec = `[${vector.join(",")}]`;
        await this.prisma.$executeRaw`
          UPDATE "document_chunks"
          SET "embedding" = ${sqlVec}::vector
          WHERE "id" = ${batch[j].id}
        `;
        embedded += 1;
      }
    }

    this.logger.log(
      `Embedded ${embedded}/${rows.length} chunks for version ${versionId}`,
    );
    return { embedded };
  }
}