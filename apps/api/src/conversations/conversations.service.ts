import { Injectable, NotFoundException } from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import type { AnswerStatus, CitationSource } from "@kiro/shared";

@Injectable()
export class ConversationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthenticatedUser) {
    const rows = await this.prisma.conversation.findMany({
      where: { tenantId: user.tenantId, userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return rows.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  }

  async create(user: AuthenticatedUser, title?: string) {
    return this.prisma.conversation.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        title: title ?? null,
      },
    });
  }

  /** Single conversation with its Q&A messages (tenant + owner scoped). */
  async get(user: AuthenticatedUser, id?: string) {
    if (!id) {
      return null;
    }
    const conversation = await this.prisma.conversation.findFirst({
      where: { id, tenantId: user.tenantId, userId: user.id },
      include: {
        requests: {
          orderBy: { createdAt: "asc" },
          include: {
            responses: {
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                evidence: {
                  include: {
                    document: { include: { source: true } },
                    version: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }

    const chunkIds = conversation.requests.flatMap((r) =>
      r.responses[0]?.evidence.map((e) => e.chunkId).filter((id): id is string => !!id) ?? [],
    );
    const chunks = chunkIds.length
      ? await this.prisma.documentChunk.findMany({
          where: { id: { in: chunkIds } },
        })
      : [];
    const chunkById = new Map(chunks.map((c) => [c.id, c]));

    return {
      id: conversation.id,
      title: conversation.title,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      messages: conversation.requests.map((r) => {
        const response = r.responses[0];
        const sources: CitationSource[] = (response?.evidence ?? []).map((e) => ({
          documentId: e.documentId,
          chunkId: e.chunkId ?? undefined,
          title: e.document.title,
          sourceName: e.document.source.name,
          version: e.version.version,
          score: e.relevanceScore,
          excerpt: (e.chunkId ? chunkById.get(e.chunkId)?.content : "")?.slice(0, 240) ?? "",
          updatedAt: e.document.updatedAt,
          classification: e.document.classification.toLowerCase() as CitationSource["classification"],
        }));
        return {
          id: r.id,
          query: r.query,
          answer: response?.answer ?? "",
          status: (response?.status as AnswerStatus) ?? "answered",
          createdAt: r.createdAt,
          sources,
        };
      }),
    };
  }
}
