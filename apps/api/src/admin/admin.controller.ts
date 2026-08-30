import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import { IngestQueueService } from "../ingestion/ingestion.queue";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: IngestQueueService,
  ) {}

  @Get("audit")
  async audit(
    @CurrentUser() user: AuthenticatedUser,
    @Query("limit") limit?: string,
  ) {
    const take = Math.min(Number(limit) || 50, 500);
    return this.prisma.auditLog.findMany({
      where: { tenantId: user.tenantId },
      orderBy: { createdAt: "desc" },
      take,
    });
  }

  @Get("ingestion")
  async ingestion(@CurrentUser() user: AuthenticatedUser) {
    const [stats, sources, docs] = await Promise.all([
      this.queue.queueStats(),
      this.prisma.source.count({ where: { tenantId: user.tenantId, deleted: false } }),
      this.prisma.document.count({ where: { tenantId: user.tenantId, deleted: false } }),
    ]);
    return { queue: stats, sources, documents: docs };
  }
}