import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";

type Check = { status: "ok" | "error"; latencyMs?: number; error?: string };

@Controller()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly ai: AiGatewayService,
  ) {}

  private async checkWithTimeout<T>(fn: () => Promise<T>, timeoutMs = 2000): Promise<Check> {
    const start = Date.now();
    try {
      await Promise.race([
        fn(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
      ]);
      return { status: "ok", latencyMs: Date.now() - start };
    } catch (err) {
      return { status: "error", latencyMs: Date.now() - start, error: err instanceof Error ? err.message : String(err) };
    }
  }

  private buildResponse(checks: Record<string, Check>) {
    const degraded = Object.values(checks).some((c) => c.status === "error");
    return {
      status: degraded ? "degraded" : "ok",
      service: "kiro-api",
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  @Get("health")
  async health() {
    const [db, redis] = await Promise.all([
      this.checkWithTimeout(() => this.prisma.$queryRaw`SELECT 1`),
      this.checkWithTimeout(() => this.redis.getClient().ping().then(() => undefined)),
    ]);
    // AI is optional — degraded but not hard-down if embedding LLM not configured
    const ai = await this.checkWithTimeout(() => this.ai.status().then(() => undefined), 3000);
    return this.buildResponse({ db, redis, ai });
  }

  @Get("admin/health")
  async adminHealth() {
    return this.health();
  }
}
