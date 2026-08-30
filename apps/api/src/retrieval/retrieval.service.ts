import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { fuseRrf, topFused } from "./fusion";

export interface RetrievedChunk {
  chunkId: string;
  documentId: string;
  versionId: string;
  version: number;
  title: string;
  sourceId: string;
  sourceName: string;
  classification: string;
  updatedAt: Date;
  content: string;
  score: number;
}

interface RawRow {
  chunkId: string;
  documentId: string;
  versionId: string;
  version: number;
  title: string;
  sourceId: string;
  sourceName: string;
  classification: string;
  updatedAt: Date;
  content: string;
  score?: number | null;
}

const SEMANTIC_LIMIT = 10;
const KEYWORD_LIMIT = 10;

/**
 * Hybrid retrieval (pgvector cosine + PostgreSQL FTS) with a mandatory
 * query-time permission filter. The permission predicate is the security
 * enforcement point: an unauthorized chunk can never leave this service.
 */
@Injectable()
export class RetrievalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiGatewayService,
  ) {}

  async search(
    user: AuthenticatedUser,
    query: string,
    limit = 5,
  ): Promise<RetrievedChunk[]> {
    const [semantic, keyword] = await Promise.all([
      this.searchSemantic(user, query).catch(() => [] as RetrievedChunk[]),
      this.searchKeyword(user, query),
    ]);

    const fused = fuseRrf([
      semantic.map((c) => c.chunkId),
      keyword.map((c) => c.chunkId),
    ]);

    const byChunk = new Map<string, RetrievedChunk>();
    for (const chunk of [...semantic, ...keyword]) {
      if (!byChunk.has(chunk.chunkId)) {
        byChunk.set(chunk.chunkId, chunk);
      }
    }

    return topFused(byChunk, fused, limit);
  }

  async searchSemantic(user: AuthenticatedUser, query: string): Promise<RetrievedChunk[]> {
    const result = await this.ai.embedTexts([query]);
    const vector = result.embeddings[0];
    const literal = `[${vector.join(",")}]`;

    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT
        dc.id AS "chunkId",
        d.id AS "documentId",
        dv.id AS "versionId",
        dv."version",
        d.title,
        d."sourceId",
        s.name AS "sourceName",
        d."classification",
        d."updatedAt",
        dc.content,
        (1 - (dc."embedding" <=> ${literal}::vector)) AS score
      FROM "document_chunks" dc
      JOIN "document_versions" dv ON dv.id = dc."documentVersionId"
      JOIN "documents" d ON d.id = dv."documentId"
      JOIN "sources" s ON s.id = d."sourceId"
      WHERE d."tenantId" = ${user.tenantId}
        AND d."deleted" = false
        AND dc."embedding" IS NOT NULL
        AND dv."approvalStatus" = 'APPROVED'
        ${this.aclFilter(user)}
      ORDER BY dc."embedding" <=> ${literal}::vector
      LIMIT ${SEMANTIC_LIMIT};
    `;

    return rows.map((r) => this.toChunk(r));
  }

  async searchKeyword(user: AuthenticatedUser, query: string): Promise<RetrievedChunk[]> {
    const rows = await this.prisma.$queryRaw<RawRow[]>`
      SELECT
        dc.id AS "chunkId",
        d.id AS "documentId",
        dv.id AS "versionId",
        dv."version",
        d.title,
        d."sourceId",
        s.name AS "sourceName",
        d."classification",
        d."updatedAt",
        dc.content,
        ts_rank(to_tsvector('english', dc.content), plainto_tsquery('english', ${query})) AS score
      FROM "document_chunks" dc
      JOIN "document_versions" dv ON dv.id = dc."documentVersionId"
      JOIN "documents" d ON d.id = dv."documentId"
      JOIN "sources" s ON s.id = d."sourceId"
      WHERE d."tenantId" = ${user.tenantId}
        AND d."deleted" = false
        AND dv."approvalStatus" = 'APPROVED'
        AND to_tsvector('english', dc.content) @@ plainto_tsquery('english', ${query})
        ${this.aclFilter(user)}
      ORDER BY score DESC
      LIMIT ${KEYWORD_LIMIT};
    `;

    return rows.map((r) => this.toChunk(r));
  }

  /**
   * Visibility rule (fail-closed):
   *   PUBLIC / INTERNAL — any user in the tenant
   *   CONFIDENTIAL / RESTRICTED — owner or an explicit USER/ROLE ACL grant
   */
  aclFilter(user: AuthenticatedUser) {
    const roleKey = user.role.toUpperCase();
    return Prisma.sql`
      AND (
        d."ownerId" = ${user.id}
        OR d."classification" IN ('PUBLIC', 'INTERNAL')
        OR EXISTS (
          SELECT 1 FROM "document_acl" a
          WHERE a."documentId" = d.id
            AND a."principalType" = 'USER'
            AND a."principalId" = ${user.id}
            AND a."permission" IN ('READ','WRITE','ADMIN')
        )
        OR EXISTS (
          SELECT 1 FROM "document_acl" a
          WHERE a."documentId" = d.id
            AND a."principalType" = 'ROLE'
            AND a."principalId" = ${roleKey}
            AND a."permission" IN ('READ','WRITE','ADMIN')
        )
      )
    `;
  }

  private toChunk(r: RawRow): RetrievedChunk {
    return {
      chunkId: r.chunkId,
      documentId: r.documentId,
      versionId: r.versionId,
      version: r.version,
      title: r.title,
      sourceId: r.sourceId,
      sourceName: r.sourceName,
      classification: r.classification,
      updatedAt: r.updatedAt,
      content: r.content,
      score: r.score ?? 0,
    };
  }
}