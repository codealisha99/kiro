import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsOptional, IsString, MinLength } from "class-validator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { ThrottleGuard } from "../common/throttle.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { BrainService } from "./brain.service";

class BrainQueryDto {
  @IsString()
  @MinLength(1)
  query!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;
}

@Controller("brain")
@UseGuards(JwtAuthGuard, ThrottleGuard)
export class BrainController {
  constructor(private readonly brain: BrainService) {}

  @Post("query")
  @HttpCode(HttpStatus.OK)
  query(@CurrentUser() user: AuthenticatedUser, @Body() dto: BrainQueryDto) {
    return this.brain.query(user, { query: dto.query, conversationId: dto.conversationId });
  }
}