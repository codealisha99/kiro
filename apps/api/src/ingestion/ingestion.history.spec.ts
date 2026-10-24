import { IngestionService } from "./ingestion.service";

const user = { id: "owner", email: "owner@example.com", tenantId: "tenant", role: "employee" as const };
function setup() {
  const prisma = {
    document: { findFirst: jest.fn().mockResolvedValue({ id: "doc", ownerId: "owner", classification: "INTERNAL", status: "PUBLISHED", versions: [
      { id: "v2", version: 2, content: "Current policy", contentHash: "current", createdAt: new Date() },
      { id: "v1", version: 1, content: null, contentHash: "earlier", createdAt: new Date() },
    ] }) },
    documentChunk: { findMany: jest.fn().mockResolvedValue([
      { id: "b", content: "Second passage", metadata: { index: 1 } },
      { id: "a", content: "First passage", metadata: { index: 0 } },
    ]) },
  };
  const service = new IngestionService(prisma as any, null as any, null as any, null as any, null as any, null as any);
  return { service, prisma };
}

describe("historical document reading", () => {
  it("reads the requested version and reconstructs legacy content from its ordered chunks", async () => {
    const { service, prisma } = setup();
    const detail = await service.getDocument(user, "doc", 1);
    expect(detail.selectedVersion).toBe(1);
    expect(detail.versionCount).toBe(2);
    expect(detail.content).toBe("First passage\n\nSecond passage");
    expect(prisma.documentChunk.findMany).toHaveBeenCalledWith({ where: { documentVersionId: "v1" } });
    expect(prisma.document.findFirst.mock.calls[0][0].where).toMatchObject({ id: "doc", tenantId: "tenant", deleted: false });
  });

  it("does not silently substitute the current version for a missing one", async () => {
    const { service, prisma } = setup();
    await expect(service.getDocument(user, "doc", 99)).rejects.toThrow("Document version not found");
    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
  });

  it("checks current document visibility before reading any historical content", async () => {
    const { service, prisma } = setup();
    prisma.document.findFirst.mockResolvedValue(null);
    await expect(service.getDocument(user, "doc", 1)).rejects.toThrow("Document not found");
    expect(prisma.documentChunk.findMany).not.toHaveBeenCalled();
  });
});
