import { IngestionService } from "./ingestion.service";

const reader = { id: "reader", tenantId: "tenant", role: "employee" as const, email: "reader@example.com" };

describe("document management authorization", () => {
  it("does not let duplicate content reclassify another person's document", async () => {
    const prisma = {
      source: { findFirst: jest.fn().mockResolvedValue({ id: "source" }) },
      document: {
        findUnique: jest.fn().mockResolvedValue({ id: "doc", ownerId: "owner", classification: "RESTRICTED" }),
        create: jest.fn(), update: jest.fn(),
      },
    };
    const service = new IngestionService(prisma as any, null as any, null as any, null as any, null as any, null as any);
    await expect(service.ingestManualDocument(reader, { title: "Policy", content: "Same content", classification: "public" })).rejects.toThrow(/Ask its owner/);
    expect(prisma.document.create).not.toHaveBeenCalled();
    expect(prisma.document.update).not.toHaveBeenCalled();
  });

  it("denies removal without ownership or an explicit admin grant", async () => {
    const prisma = {
      document: { findFirst: jest.fn().mockResolvedValue({ id: "doc", ownerId: "owner" }), update: jest.fn() },
      documentACL: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const service = new IngestionService(prisma as any, null as any, null as any, null as any, null as any, null as any);
    await expect(service.deleteDocument(reader, "doc")).rejects.toThrow("Document not found");
    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(prisma.documentACL.findFirst).toHaveBeenCalledWith({ where: { documentId: "doc", principalType: "USER", principalId: "reader", permission: "ADMIN" } });
  });
});
