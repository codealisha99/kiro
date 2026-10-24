import { IngestionService } from "./ingestion.service";
import { createHash } from "node:crypto";

const owner = { id: "owner", email: "owner@example.com", tenantId: "tenant", role: "employee" as const };
const content = "Original policy";
function setup() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    document: {
      findFirst: jest.fn().mockResolvedValue({ id: "doc", ownerId: "owner", title: "Policy" }),
      update: jest.fn().mockResolvedValue({}),
    },
    documentVersion: {
      findFirst: jest.fn().mockResolvedValue({ version: 1, contentHash: createHash("sha256").update(content).digest("hex") }),
      create: jest.fn().mockResolvedValue({ id: "revision" }),
    },
    documentChunk: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    documentACL: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
  const queue = { enqueueEmbedVersion: jest.fn().mockResolvedValue({}) };
  const service = new IngestionService(prisma as any,
    { chunk: () => [{ index: 0, content: "Updated policy" }] } as any,
    queue as any, null as any, null as any, null as any);
  jest.spyOn(service, "getDocument").mockResolvedValue({ selectedVersion: 2 } as any);
  return { tx, prisma, queue, service };
}

describe("document revisions", () => {
  it("creates a revision without replacing the original or changing document access", async () => {
    const { service, tx, queue } = setup();
    await service.updateDocument(owner, "doc", { title: "New title", content: "Updated policy", expectedVersion: 1 });
    expect(tx.documentVersion.create).toHaveBeenCalledWith({ data: expect.objectContaining({ documentId: "doc", version: 2, content: "Updated policy" }) });
    expect(tx.document.update).toHaveBeenCalledWith({ where: { id: "doc" }, data: { title: "New title", updatedAt: expect.any(Date) } });
    expect(queue.enqueueEmbedVersion).toHaveBeenCalledWith("revision");
    expect(tx.document.findFirst).toHaveBeenCalledWith({ where: { id: "doc", tenantId: "tenant", deleted: false } });
  });

  it("rejects a stale version before making any changes", async () => {
    const { service, tx, queue } = setup();
    await expect(service.updateDocument(owner, "doc", { title: "Policy", content: "Updated policy", expectedVersion: 9 })).rejects.toThrow(/newer version/);
    expect(tx.documentVersion.create).not.toHaveBeenCalled();
    expect(tx.document.update).not.toHaveBeenCalled();
    expect(queue.enqueueEmbedVersion).not.toHaveBeenCalled();
  });

  it("denies a reader even if the document is otherwise visible", async () => {
    const { service, tx } = setup();
    await expect(service.updateDocument({ ...owner, id: "reader" }, "doc", { title: "Policy", content: "Updated policy", expectedVersion: 1 })).rejects.toThrow("Document not found");
    expect(tx.documentVersion.create).not.toHaveBeenCalled();
  });

  it("does not create duplicate revisions for an unchanged save", async () => {
    const { service, tx, queue } = setup();
    await service.updateDocument(owner, "doc", { title: "Policy", content, expectedVersion: 1 });
    expect(tx.documentVersion.create).not.toHaveBeenCalled();
    expect(queue.enqueueEmbedVersion).not.toHaveBeenCalled();
  });

  it("still returns a committed revision when embedding queueing fails", async () => {
    const { service, queue } = setup();
    queue.enqueueEmbedVersion.mockRejectedValue(new Error("Redis unavailable"));
    await expect(service.updateDocument(owner, "doc", { title: "Policy", content: "Updated policy", expectedVersion: 1 })).resolves.toEqual({ selectedVersion: 2 });
  });
});
