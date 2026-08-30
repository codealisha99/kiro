import { Global, Module } from "@nestjs/common";
import { IngestionService } from "./ingestion.service";
import { ParserService } from "./parser.service";
import { ChunkerService, CHUNKER_CHUNK_SIZE, CHUNKER_OVERLAP } from "./chunker.service";
import { IngestQueueService } from "./ingestion.queue";
import { IngestionProcessor } from "./ingestion.processor";
import { SourcesController } from "./sources.controller";
import { DocumentsController } from "./documents.controller";
import { UsersModule } from "../users/users.module";

@Global()
@Module({
  imports: [UsersModule],
  controllers: [SourcesController, DocumentsController],
  providers: [
    IngestionService,
    ParserService,
    ChunkerService,
    { provide: CHUNKER_CHUNK_SIZE, useValue: 1000 },
    { provide: CHUNKER_OVERLAP, useValue: 200 },
    IngestQueueService,
    IngestionProcessor,
  ],
  exports: [IngestionService, ParserService, ChunkerService, IngestQueueService, IngestionProcessor],
})
export class IngestionModule {}