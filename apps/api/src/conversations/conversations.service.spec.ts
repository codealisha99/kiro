import { ConversationsService } from "./conversations.service";

const user = { id: "u1", tenantId: "t1", role: "employee" as const, email: "reader@example.com" };

function setup(visibleIds: string[]) {
  const evidence = ["d1", "d2"].map((id, index) => ({
    documentId: id, chunkId: `chunk-${id}`, citationIndex: index + 2, relevanceScore: 0.9,
    document: { title: `Title ${id}`, classification: "RESTRICTED", source: { name: "Handbook" }, updatedAt: new Date() },
    version: { version: 1 },
  }));
  const prisma = {
    conversation: { findFirst: jest.fn().mockResolvedValue({
      id: "conv", requests: [{ id: "req", query: "policy?", responses: [{ answer: "Secret [2][3]", status: "answered", evidence }] }],
    }) },
    document: { findMany: jest.fn().mockResolvedValue(visibleIds.map((id) => ({ id }))) },
    documentChunk: { findMany: jest.fn().mockResolvedValue(evidence.map((e) => ({ id: e.chunkId, content: "Private passage" }))) },
  };
  return { prisma, service: new ConversationsService(prisma as any) };
}

describe("saved conversation evidence", () => {
  it("withholds the entire answer and all source metadata if any source is no longer readable", async () => {
    const { service, prisma } = setup(["d1"]);
    const result = await service.get(user, "conv");
    expect(result!.messages[0]).toMatchObject({ status: "unknown", sources: [] });
    expect(result!.messages[0].answer).not.toContain("Secret");
    expect(JSON.stringify(result)).not.toContain("Private passage");
    expect(prisma.document.findMany.mock.calls[0][0].where).toMatchObject({ tenantId: "t1", deleted: false });
    expect(prisma.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: "conv", tenantId: "t1", userId: "u1" });
  });

  it("preserves authorized answers and original citation numbers", async () => {
    const { service } = setup(["d1", "d2"]);
    const result = await service.get(user, "conv");
    expect(result!.messages[0].answer).toBe("Secret [2][3]");
    expect(result!.messages[0].sources.map((s) => s.citationIndex)).toEqual([2, 3]);
  });

  it("rejects a conversation outside the current tenant and user", async () => {
    const { service, prisma } = setup([]);
    prisma.conversation.findFirst.mockResolvedValue(null);
    await expect(service.get(user, "other")).rejects.toThrow("Conversation not found");
    expect(prisma.document.findMany).not.toHaveBeenCalled();
  });
});
