import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { IngestionService } from "./ingestion.service";
import { IngestDocumentDto } from "./dto/ingestion.dto";

@Controller("documents")
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly ingestion: IngestionService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.ingestion.listDocuments(user);
  }

  @Post("upload")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  upload(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file: Express.Multer.File,
    @Body("title") title?: string,
    @Body("classification") classification?: string,
  ) {
    if (!file) {
      throw new BadRequestException("Attach a file under the field name \"file\"");
    }
    return this.ingestion.ingestUploadedFile(user, file, {
      title,
      classification,
    });
  }

  @Post("demo")
  seedDemo(@CurrentUser() user: AuthenticatedUser) {
    return this.ingestion.seedDemo(user);
  }

  @Get(":id")
  get(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.ingestion.getDocument(user, id);
  }

  @Post()
  ingest(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: IngestDocumentDto,
  ) {
    return this.ingestion.ingestManualDocument(user, dto);
  }
}
