import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { IngestionService } from "./ingestion.service";
import { CreateSourceDto } from "./dto/ingestion.dto";

@Controller("sources")
@UseGuards(JwtAuthGuard)
export class SourcesController {
  constructor(private readonly ingestion: IngestionService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.ingestion.listSources(user);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles("manager", "admin")
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSourceDto) {
    return this.ingestion.createSource(user, dto.type, dto.name);
  }

  @Delete(":id")
  @UseGuards(RolesGuard)
  @Roles("admin")
  remove(@CurrentUser() user: AuthenticatedUser, @Param("id") id: string) {
    return this.ingestion.deleteSource(user, id);
  }
}