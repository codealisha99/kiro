import { ConflictException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

jest.mock("bcryptjs", () => ({
  hash: jest.fn().mockResolvedValue("hash"),
  compare: jest.fn().mockResolvedValue(true),
}));
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const mockUser = {
  id: "u1",
  tenantId: "t1",
  email: "a@b.co",
  name: "Alice",
  password: "hash",
  role: Role.ADMIN,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function buildService(overrides: Record<string, unknown> = {}) {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    tenant: {
      create: jest.fn(),
    },
    ...(overrides.prisma ?? {}),
  };
  const jwt = {
    signAsync: jest.fn().mockResolvedValue("signed-token"),
    ...(overrides.jwt ?? {}),
  };
  const config = {
    get: jest.fn().mockImplementation((k: string, d?: unknown) =>
      k === "JWT_EXPIRES_IN_SECONDS" ? 3600 : d,
    ),
  } as unknown as ConfigService;
  const redis = {
    set: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    ...(overrides.redis ?? {}),
  };

  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    config,
    redis as unknown as RedisService,
  );

  return { service, prisma, jwt, redis };
}

describe("AuthService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedBcrypt.hash.mockResolvedValue("hash" as never);
    mockedBcrypt.compare.mockResolvedValue(true as never);
  });

  describe("register", () => {
    it("creates a tenant and admin user, returning tokens", async () => {
      const { service, prisma, jwt, redis } = buildService();
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.tenant.create.mockResolvedValue({ id: "t1" });
      prisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register({
        tenantName: "Acme",
        email: "a@b.co",
        password: "password1",
      });

      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tenantId: "t1",
            role: Role.ADMIN,
            email: "a@b.co",
          }),
        }),
      );
      expect(jwt.signAsync).toHaveBeenCalled();
      expect(redis.set).toHaveBeenCalled();
      expect(result.user.role).toBe("admin");
      expect(result.tokens.accessToken).toBe("signed-token");
    });

    it("rejects a duplicate email", async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.register({
          tenantName: "Acme",
          email: "a@b.co",
          password: "password1",
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe("login", () => {
    it("authenticates with valid credentials", async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.login({ email: "a@b.co", password: "x" });
      expect(result.user.email).toBe("a@b.co");
      expect(mockedBcrypt.compare).toHaveBeenCalled();
    });

    it("throws on wrong password", async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      await expect(
        service.login({ email: "a@b.co", password: "wrong" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("throws when user has no local password (SSO-only)", async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, password: null });

      await expect(
        service.login({ email: "a@b.co", password: "x" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("logout", () => {
    it("invalidates the session token", async () => {
      const { service, prisma, redis } = buildService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const res = await service.logout(
        { id: "u1", email: "a@b.co", tenantId: "t1", role: "admin" },
        "tok",
      );
      expect(res.ok).toBe(true);
      expect(redis.del).toHaveBeenCalledWith("jti:tok");
      expect(redis.del).toHaveBeenCalledWith("session:u1");
    });
  });

  describe("me", () => {
    it("returns the user within the same tenant", async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const me = await service.me({
        id: "u1",
        email: "a@b.co",
        tenantId: "t1",
        role: "admin",
      });
      expect(me.id).toBe("u1");
    });

    it("rejects a session whose tenant changed", async () => {
      const { service, prisma } = buildService();
      prisma.user.findUnique.mockResolvedValue({ ...mockUser, tenantId: "other" });

      await expect(
        service.me({ id: "u1", email: "a@b.co", tenantId: "t1", role: "admin" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
