import { UsersService } from "./users.service";
import { PrismaService } from "../prisma/prisma.service";

describe("UsersService — tenant isolation", () => {
  it("filters users strictly by the caller's tenantId", async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { user: { findMany } } as unknown as PrismaService;
    const service = new UsersService(prisma);

    await service.listByTenant({
      id: "u1",
      email: "a@b.co",
      tenantId: "tenant-A",
      role: "admin",
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: "tenant-A" } }),
    );
    // Cross-tenant rows must never be returned: assert no tenantId omission.
    const where = (findMany.mock.calls[0][0] as { where: { tenantId: string } }).where;
    expect(where.tenantId).toBeDefined();
  });
});
