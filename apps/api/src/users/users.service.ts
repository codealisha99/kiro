import { ConflictException, Injectable } from "@nestjs/common";
import { Role } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";

const ROLE_MAP: Record<string, Role> = {
  employee: Role.EMPLOYEE,
  manager: Role.MANAGER,
  admin: Role.ADMIN,
};

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant-scoped list — every query is filtered by the caller's tenant. */
  async listByTenant(user: AuthenticatedUser) {
    return this.prisma.user.findMany({
      where: { tenantId: user.tenantId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  async invite(
    actor: AuthenticatedUser,
    input: { email: string; password: string; name?: string; role?: string },
  ) {
    const email = input.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException("A user with this email already exists");
    }

    const role = ROLE_MAP[input.role ?? "employee"] ?? Role.EMPLOYEE;
    const password = await bcrypt.hash(input.password, 10);
    const created = await this.prisma.user.create({
      data: {
        tenantId: actor.tenantId,
        email,
        name: input.name ?? null,
        password,
        role,
      },
    });

    return {
      id: created.id,
      tenantId: created.tenantId,
      email: created.email,
      name: created.name,
      role: created.role.toLowerCase(),
    };
  }

  async ensureDemoViewer(actor: AuthenticatedUser) {
    const email = `viewer@${slugTenant(actor.tenantId)}.demo`;
    const password = "northwind-viewer";
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { email, password, role: existing.role.toLowerCase() };
    }
    await this.invite(actor, {
      email,
      password,
      name: "Avery Chen",
      role: "employee",
    });
    return { email, password, role: "employee" };
  }
}

function slugTenant(tenantId: string): string {
  return tenantId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toLowerCase() || "tenant";
}
