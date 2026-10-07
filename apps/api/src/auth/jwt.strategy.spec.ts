import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Request } from "express";
import { JwtStrategy } from "./jwt.strategy";
import { RedisService } from "../redis/redis.service";

jest.mock("@nestjs/passport", () => ({
  PassportStrategy: () => {
    return class {};
  },
}));

describe("JwtStrategy", () => {
  function build(redisOverrides: Partial<RedisService> = {}) {
    const config = {
      get: jest.fn().mockImplementation((k: string, d?: unknown) =>
        k === "JWT_SECRET" ? "test-secret" : d,
      ),
    } as unknown as ConfigService;
    const redis = {
      get: jest.fn().mockResolvedValue("signed-token"),
      ...redisOverrides,
    } as unknown as RedisService;
    const strategy = new JwtStrategy(config, redis);
    return { strategy, redis };
  }

  const payload = {
    sub: "u1",
    email: "a@b.co",
    tenantId: "t1",
    role: "admin" as const,
  };

  it("accepts a token that matches the Redis session", async () => {
    const { strategy } = build();
    const req = {
      headers: { authorization: "Bearer signed-token" },
    } as unknown as Request;

    const user = await strategy.validate(req, payload);
    expect(user).toEqual({
      id: "u1",
      email: "a@b.co",
      tenantId: "t1",
      role: "admin",
    });
  });

  it("rejects when the Redis session is missing (logged out)", async () => {
    const { strategy } = build({
      get: jest.fn().mockResolvedValue(null),
    } as Partial<RedisService>);
    const req = {
      headers: { authorization: "Bearer signed-token" },
    } as unknown as Request;

    await expect(strategy.validate(req, payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("rejects a stale token that no longer matches the session", async () => {
    const { strategy } = build({
      get: jest.fn().mockResolvedValue("newer-token"),
    } as Partial<RedisService>);
    const req = {
      headers: { authorization: "Bearer signed-token" },
    } as unknown as Request;

    await expect(strategy.validate(req, payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("fails closed when Redis is unavailable", async () => {
    const { strategy } = build({
      get: jest.fn().mockRejectedValue(new Error("down")),
    } as Partial<RedisService>);
    const req = {
      headers: { authorization: "Bearer signed-token" },
    } as unknown as Request;

    await expect(strategy.validate(req, payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
