import { IngestionService } from "./ingestion.service";

function makePrisma() {
  return {
    document: { findFirst: jest.fn(), update: jest.fn() },
    documentACL: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }), findFirst: jest.fn() },
    documentVersion: { findMany: jest.fn(), findFirst: jest.fn() },
    source: { findFirst: jest.fn() },
  } as any;
}

describe("IngestionService revocation", () => {
  it("revokes an ACL entry when owner calls", async () => {
    const prisma = makePrisma();
    prisma.document.findFirst.mockResolvedValue({ id: "d1", tenantId: "t1", ownerId: "u1" });
    const svc = new IngestionService(prisma, null as any, null as any, null as any, null as any, null as any);
    const res = await svc.revokeAccess({ id: "u1", tenantId: "t1", role: "employee" } as any, "d1", "role", "MANAGER");
    expect(res).toEqual({ ok: true });
    expect(prisma.documentACL.deleteMany).toHaveBeenCalledWith({
      where: { documentId: "d1", principalType: "ROLE", principalId: "MANAGER" },
    });
  });

  it("rejects revocation by non-owner non-admin", async () => {
    const prisma = makePrisma();
    prisma.document.findFirst.mockResolvedValue({ id: "d1", tenantId: "t1", ownerId: "u9" });
    const svc = new IngestionService(prisma, null as any, null as any, null as any, null as any, null as any);
    await expect(
      svc.revokeAccess({ id: "u1", tenantId: "t1", role: "employee" } as any, "d1", "role", "MANAGER"),
    ).rejects.toThrow();
  });
});
