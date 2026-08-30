import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import { Role } from "@prisma/client";
import type { AuthenticatedUser } from "./jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { LoginDto, RegisterDto } from "./dto/auth.dto";
import * as bcrypt from "bcryptjs";

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const tenant = await this.prisma.tenant.create({
      data: { name: dto.tenantName },
    });

    const user = await this.prisma.user.create({
      data: {
        tenantId: tenant.id,
        email: dto.email.toLowerCase(),
        name: dto.name,
        password: passwordHash,
        role: Role.ADMIN, // first user bootstraps the tenant as admin
      },
    });

    const tokens = await this.issueTokens(user.id, user);

    return {
      user: this.toUserDto(user),
      tokens,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user?.password) {
      throw new UnauthorizedException("Invalid credentials");
    }
    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.issueTokens(user.id, user);
    return { user: this.toUserDto(user), tokens };
  }

  async logout(user: AuthenticatedUser, token?: string) {
    if (token) {
      await this.redis.del(`jti:${token}`);
    }
    await this.redis.del(`session:${user.id}`);
    return { ok: true };
  }

  async me(user: AuthenticatedUser) {
    const db = await this.prisma.user.findUnique({ where: { id: user.id } });
    if (!db || db.tenantId !== user.tenantId) {
      throw new UnauthorizedException("Session no longer valid");
    }
    return this.toUserDto(db);
  }

  private async issueTokens(
    userId: string,
    user: { tenantId: string; email: string; role: Role },
  ) {
    const role = user.role.toLowerCase() as AuthenticatedUser["role"];
    const payload = {
      sub: userId,
      email: user.email,
      tenantId: user.tenantId,
      role,
    };
    const expiresIn = this.config.get<number>("JWT_EXPIRES_IN_SECONDS", 3600);
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });
    await this.redis.set(`session:${userId}`, accessToken, SESSION_TTL_SECONDS);
    return { accessToken, expiresIn };
  }

  private toUserDto(user: {
    id: string;
    tenantId: string;
    email: string;
    name: string | null;
    role: Role;
  }) {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      name: user.name,
      role: user.role.toLowerCase() as AuthenticatedUser["role"],
    };
  }
}
