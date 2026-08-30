import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";
import { Job, Queue, Worker } from "bullmq";

import { IngestionProcessor } from "./ingestion.processor";

const QUEUE_NAME = "ingestion";

@Injectable()
export class IngestQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestQueueService.name);
  private queue!: Queue;
  private worker!: Worker;
  private queueConnection!: Redis;
  private workerConnection!: Redis;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: IngestionProcessor,
  ) {}

  async onModuleInit() {
    const url = this.config.get<string>("REDIS_URL", "redis://localhost:6379");
    const opts = { maxRetriesPerRequest: null };
    this.queueConnection = new Redis(url, opts);
    this.workerConnection = new Redis(url, opts);

    this.queue = new Queue(QUEUE_NAME, { connection: this.queueConnection });

    this.worker = new Worker(
      QUEUE_NAME,
      async (job) => this.processor.handle(job),
      { connection: this.workerConnection, concurrency: 4 },
    );
    this.worker.on("failed", (job, err) => {
      this.logger.error(
        `Ingestion job ${job?.id} (${job?.name}) failed: ${err.message}`,
      );
    });

    this.logger.log("Ingestion queue + worker ready");
  }

  async onModuleDestroy() {
    await this.worker?.close().catch(() => undefined);
    await this.queue?.close().catch(() => undefined);
    await this.queueConnection?.quit().catch(() => undefined);
    await this.workerConnection?.quit().catch(() => undefined);
  }

  /** Enqueue chunk-embedding for a document version (idempotent per version). */
  async enqueueEmbedVersion(versionId: string) {
    return this.queue?.add(
      "embed-version",
      { versionId },
      {
        jobId: `embed-version-${versionId}`,
        attempts: 4,
        backoff: { type: "exponential", delay: 5_000 },
        removeOnComplete: 200,
        removeOnFail: 5000,
      },
    );
  }

  async queueStats() {
    if (!this.queue) {
      return {};
    }
    return this.queue.getJobCounts(
      "waiting",
      "active",
      "completed",
      "failed",
      "delayed",
    );
  }
}

export type IngestJob = Job<{ versionId: string }>;