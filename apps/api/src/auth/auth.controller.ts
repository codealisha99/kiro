import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { AuthService } from "./auth.service";
import { LoginDto, RegisterDto } from "./dto/auth.dto";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "./jwt-payload.interface";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  logout(
    @CurrentUser() user: AuthenticatedUser,
    @Headers("authorization") authHeader?: string,
  ) {
    const token = authHeader?.replace(/^Bearer\s+/i, "");
    return this.auth.logout(user, token);
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.auth.me(user);
  }
}
