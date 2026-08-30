import { RetrievalService } from "./retrieval.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";

const user = { id: "u1", email: "a@b.co", tenantId: "t1", role: "manager" as const };

type QueryRawMock = jest.MockedFunction<PrismaService["$queryRaw"]>;

interface SqlFragment {
  strings: string[];
  values: unknown[];
}

function isFragment(v: unknown): v is SqlFragment {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as SqlFragment).strings) &&
    "values" in (v as object)
  );
}

/** All SQL text across the template strings AND inlined fragment args. */
function fullSql(call: unknown[]): string {
  const arg = call[0];
  const pieces: string[] = [];
  if (Array.isArray(arg)) {
    pieces.push(arg.join("?"));
  }
  for (const v of call.slice(1)) {
    if (isFragment(v)) {
      pieces.push(v.strings.join("?"));
    }
  }
  return pieces.join("");
}

/** All scalar + fragment values in order. */
function allValues(call: unknown[]): unknown[] {
  const values: unknown[] = [];
  for (const v of call.slice(1)) {
    if (isFragment(v)) {
      values.push(...v.values);
    } else {
      values.push(v);
    }
  }
  return values;
}

function firstFragment(call: unknown[]): SqlFragment {
  const fragment = call.slice(1).find(isFragment);
  if (!fragment) {
    throw new Error("no Prisma.sql fragment found in call args");
  }
  return fragment;
}

function mockRaw(returnValue: unknown): { queryRaw: QueryRawMock; prisma: PrismaService } {
  const queryRaw = jest.fn().mockResolvedValue(returnValue) as unknown as QueryRawMock;
  return { queryRaw, prisma: { $queryRaw: queryRaw } as unknown as PrismaService };
}

function makeChunk(chunkId: string, title: string) {
  return {
    chunkId,
    documentId: `d-${chunkId}`,
    versionId: `v-${chunkId}`,
    version: 1,
    title,
    sourceId: "s1",
    sourceName: "Manual ingest",
    classification: "INTERNAL",
    updatedAt: new Date(),
    content: `${title} content`,
    score: 1,
  };
}

describe("RetrievalService — query-time authorization (fail closed)", () => {
  it("builds an ACL predicate that requires owner, PUBLIC, USER grant or ROLE grant", () => {
    const service = new RetrievalService({} as PrismaService, {} as AiGatewayService);
    const clause = (
      service as unknown as { aclFilter(u: AuthenticatedUser): SqlFragment }
    ).aclFilter(user);

    const sql = clause.strings.join("?");
    expect(sql).toContain('d."ownerId"');
    expect(sql).toContain("document_acl");
    expect(sql).toContain("'PUBLIC'");
    expect(sql).toContain("'USER'");
    expect(sql).toContain("'ROLE'");
    // bound params are the caller's identity — never another principal's
    expect(clause.values).toContain("u1");
    expect(clause.values).toContain("MANAGER");
  });

  it("embeds the query and inlines the ACL fragment into pgvector search", async () => {
    const { queryRaw, prisma } = mockRaw([]);
    const ai = {
      embedTexts: jest.fn().mockResolvedValue({ embeddings: [[0.1, 0.2, 0.3]], model: "m", dimensions: 3 }),
    } as unknown as AiGatewayService;

    const service = new RetrievalService(prisma, ai);
    await service.searchSemantic(user, "refund policy");

    const sql = fullSql(queryRaw.mock.calls[0]);
    expect(sql).toContain('"tenantId" = ?');
    expect(sql).toContain('dc."embedding" IS NOT NULL');
    expect(sql).toContain('ORDER BY dc."embedding" <=> ?::vector');
    expect(sql).toContain("document_acl");
    const vals = firstFragment(queryRaw.mock.calls[0]).values;
    expect(vals).toContain("u1");
    expect(vals).toContain("MANAGER");

    const values = allValues(queryRaw.mock.calls[0]);
    expect(values).toContain("t1");
    expect(values).toContain("u1");
    expect(values).toContain("MANAGER");
  });

  it("inlines the ACL fragment into keyword search too", async () => {
    const { queryRaw, prisma } = mockRaw([]);
    const ai = {
      embedTexts: jest.fn().mockResolvedValue({ embeddings: [[0.1]], model: "m", dimensions: 1 }),
    } as unknown as AiGatewayService;

    const service = new RetrievalService(prisma, ai);
    await service.searchKeyword(user, "supplier onboarding");

    const sql = fullSql(queryRaw.mock.calls[0]);
    expect(sql).toContain("to_tsvector");
    expect(sql).toContain("document_acl");
    expect(sql).toContain('d."ownerId"');
    expect(sql).toContain("IN ('PUBLIC', 'INTERNAL')");
  });

  it("merges semantic + keyword via RRF and caps results", async () => {
    const queryRaw = jest
      .fn()
      .mockResolvedValueOnce([
        makeChunk("c1", "Refund policy v2"),
        makeChunk("c2", "Refund policy old"),
      ])
      .mockResolvedValueOnce([makeChunk("c2", "Refund policy old")]) as unknown as QueryRawMock;

    const prisma = { $queryRaw: queryRaw } as unknown as PrismaService;
    const ai = {
      embedTexts: jest.fn().mockResolvedValue({ embeddings: [[0.1]], model: "m", dimensions: 1 }),
    } as unknown as AiGatewayService;

    const service = new RetrievalService(prisma, ai);
    const results = await service.search(user, "refund policy", 5);

    // c2 appears in both lists → wins on RRF.
    expect(results[0].chunkId).toBe("c2");
    expect(results.length).toBeLessThanOrEqual(5);
  });
});