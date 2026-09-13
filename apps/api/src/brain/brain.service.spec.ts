import { ServiceUnavailableException } from "@nestjs/common";
import { BrainService } from "./brain.service";
import { PrismaService } from "../prisma/prisma.service";
import { RetrievalService } from "../retrieval/retrieval.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { ConversationsService } from "../conversations/conversations.service";
import { MetricsService } from "../metrics/metrics.service";

const user = { id: "u1", email: "a@b.co", tenantId: "t1", role: "employee" as const };

function makeChunk(partial: Partial<{ documentId: string; title: string; content: string; score: number }> = {}) {
  return {
    chunkId: "chunk-1",
    documentId: partial.documentId ?? "d1",
    versionId: "v1",
    version: 2,
    title: partial.title ?? "Refund policy",
    sourceId: "s1",
    sourceName: "Manual ingest",
    classification: "INTERNAL",
    updatedAt: new Date(),
    content: partial.content ?? "Refunds are issued within 14 days.",
    score: partial.score ?? 0.87,
  };
}

function buildPrisma() {
  return {
    aIRequest: { create: jest.fn().mockResolvedValue({ id: "req-1" }) },
    aIResponse: {
      create: jest.fn().mockResolvedValue({ id: "resp-1", answer: "x" }),
    },
    responseEvidence: { createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    auditLog: { create: jest.fn().mockResolvedValue({ id: "audit-1" }) },
  } as unknown as PrismaService;
}

describe("BrainService", () => {
  it("short-circuits to a grounded 'I don't know' when no authorized evidence exists", async () => {
    const prisma = buildPrisma();
    const conversations = {
      get: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "conv-1" }),
    } as unknown as ConversationsService;
    const retrieval = { search: jest.fn().mockResolvedValue([]) } as unknown as RetrievalService;
    const ai = { generate: jest.fn() } as unknown as AiGatewayService;

    const metrics = { incr: jest.fn(), observeLatency: jest.fn() } as unknown as MetricsService;
    const service = new BrainService(prisma, retrieval, ai, conversations, metrics);
    const result = await service.query(user, { query: "What was our revenue in 2035?" });

    expect(result.status).toBe("unknown");
    expect(result.answer).toContain("don't have sufficient information");
    expect(result.sources).toEqual([]);
    // No LLM call must happen for an unknown with no evidence.
    expect(ai.generate).not.toHaveBeenCalled();
    // Every access is audited.
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
  });

  it("builds a cited, grounded answer from authorized evidence", async () => {
    const prisma = buildPrisma();
    const conversations = {
      get: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "conv-1" }),
    } as unknown as ConversationsService;
    const retrieval = {
      search: jest.fn().mockResolvedValue([makeChunk({}, ), makeChunk({ documentId: "d2", content: "Old policy: 30 days" }) ]),
    } as unknown as RetrievalService;
    const ai = {
      generate: jest
        .fn()
        .mockResolvedValue({
          text: "STATUS:answered\nRefunds are issued within 14 days. [1] Older docs said 30 days but the current policy applies.",
          model: "test-model",
          modelVersion: "test-model",
          usage: {},
        }),
    } as unknown as AiGatewayService;

    const metrics = { incr: jest.fn(), observeLatency: jest.fn() } as unknown as MetricsService;
    const service = new BrainService(prisma, retrieval, ai, conversations, metrics);
    const result = await service.query(user, { query: "What is our refund policy?" });

    expect(result.status).toBe("answered");
    expect(result.answer).not.toContain("STATUS:");
    expect(result.sources.length).toBe(1); // only [1] cited
    expect(result.sources[0].documentId).toBe("d1");
    expect(result.sources[0].version).toBe(2);

    // Evidence + audit persisted.
    expect(prisma.aIResponse.create).toHaveBeenCalled();
    expect(prisma.responseEvidence.createMany).toHaveBeenCalled();
  });

  it("maps an LLM unknown verdict to the unknown status", async () => {
    const prisma = buildPrisma();
    const conversations = {
      get: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "conv-1" }),
    } as unknown as ConversationsService;
    const retrieval = {
      search: jest.fn().mockResolvedValue([makeChunk({ content: "Nothing about revenue." })]),
    } as unknown as RetrievalService;
    const ai = {
      generate: jest.fn().mockResolvedValue({
        text: "STATUS:unknown\nThe evidence does not contain revenue figures.",
        model: "test",
        modelVersion: "test",
        usage: {},
      }),
    } as unknown as AiGatewayService;

    const metrics = { incr: jest.fn(), observeLatency: jest.fn() } as unknown as MetricsService;
    const service = new BrainService(prisma, retrieval, ai, conversations, metrics);
    const result = await service.query(user, { query: "What was our revenue?" });
    expect(result.status).toBe("unknown");
    expect(result.answer).toBe("The evidence does not contain revenue figures.");
  });

  it("audits failures and surfaces a service error", async () => {
    const prisma = buildPrisma();
    const conversations = {
      get: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: "conv-1" }),
    } as unknown as ConversationsService;
    const retrieval = {
      search: jest.fn().mockRejectedValue(new Error("pgvector down")),
    } as unknown as RetrievalService;

    const metrics = { incr: jest.fn(), observeLatency: jest.fn() } as unknown as MetricsService;
    const service = new BrainService(
      prisma,
      retrieval,
      {} as AiGatewayService,
      conversations,
      metrics,
    );

    await expect(service.query(user, { query: "anything" })).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    // failure audited
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    const failed = (prisma.auditLog.create as jest.Mock).mock.calls.map((c) => c[0].data.action);
    expect(failed).toContain("query.failed");
  });
});

function parsedStatus(result: { answer: string }) {
  const m = result.answer.match(/^STATUS:(\w+)/);
  return m ? m[1] : "no-status";
}