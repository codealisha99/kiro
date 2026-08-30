import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsBoolean, IsOptional, IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";

class FeedbackDto {
  @IsString()
  @MinLength(1)
  requestId!: string;

  @IsBoolean()
  helpful!: boolean;

  @IsOptional()
  @IsString()
  comment?: string;
}

@Controller("feedback")
@UseGuards(JwtAuthGuard)
export class FeedbackController {
  constructor(private readonly prisma: PrismaService) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: FeedbackDto) {
    // Must reference a request the user actually made (tenant + owner scoped).
    const request = await this.prisma.aIRequest.findFirst({
      where: { id: dto.requestId, tenantId: user.tenantId, userId: user.id },
    });
    if (!request) {
      throw new NotFoundException("Request not found");
    }
    await this.prisma.feedback.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        requestId: request.id,
        helpful: dto.helpful,
        comment: dto.comment,
      },
    });
    return { ok: true };
  }
}