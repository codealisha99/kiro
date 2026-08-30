import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";
import { PrismaService } from "../prisma/prisma.service";
import { RetrievalService, RetrievedChunk } from "../retrieval/retrieval.service";
import { AiGatewayService } from "../ai-gateway/ai-gateway.service";
import { ConversationsService } from "../conversations/conversations.service";
import type { AnswerStatus, BrainQueryResponse, CitationSource } from "@kiro/shared";

export interface BrainQueryInput {
  query: string;
  conversationId?: string;
}

const TOP_K = 5;
const EXCERPT_LENGTH = 240;

const SYSTEM_PROMPT = `You are Kiro, an internal enterprise knowledge assistant.
Answer ONLY from the evidence supplied below. Follow these rules strictly:
1. Base your answer exclusively on the provided evidence. If the evidence is insufficient to answer, say so and mark the status "unknown".
2. After each statement, cite the supporting evidence using its bracket number, e.g. [1]. For multiple supporting pieces use [1][2].
3. If the evidence sources conflict with each other, state the conflict explicitly and describe both sides.
4. Never invent facts, figures, documents, links, or sources not present in the evidence.
5. If the question is ambiguous, say what you assumed or ask a clarifying question and mark the status "ambiguous".
6. Begin your reply with a single line in the exact format STATUS:<answered|unknown|ambiguous|partial> followed by a newline and then your answer.`;

type AnswerParse = { status: AnswerStatus; answer: string };

@Injectable()
export class BrainService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly retrieval: RetrievalService,
    private readonly ai: AiGatewayService,
    private readonly conversations: ConversationsService,
  ) {}

  async query(
    user: AuthenticatedUser,
    input: BrainQueryInput,
  ): Promise<BrainQueryResponse> {
    const question = input.query.trim();
    if (!question) {
      throw new NotFoundException("query is required");
    }

    let conversation: { id: string } | null =
      (await this.conversations.get(user, input.conversationId)) ?? null;
    if (!conversation) {
      conversation = await this.conversations.create(
        user,
        question.length > 60 ? `${question.slice(0, 60)}…` : question,
      );
    }

    const request = await this.prisma.aIRequest.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        conversationId: conversation.id,
        query: question,
      },
    });

    await this.audit(user, {
      action: "query.received",
      resource: "conversation",
      resourceId: conversation.id,
      query: question,
    });

    try {
      const chunks = await this.retrieval.search(user, question, TOP_K);

      if (chunks.length === 0) {
        const answer =
          "I don't have sufficient information to answer that. Try asking about ingested documents.";
        const response = await this.saveResponse(
          request,
          answer,
          "unknown",
          0,
          [],
          [],
          null,
        );
        await this.audit(user, {
          action: "query.completed",
          resource: "response",
          resourceId: response.id,
          query: question,
          retrievedSources: [],
          permissionDecision: "allowed:no_evidence",
        });
        return {
          requestId: request.id,
          conversationId: conversation.id,
          question,
          answer,
          status: "unknown",
          confidence: 0,
          sources: [],
        };
      }

      const context = chunks
        .map((c, i) => `[${i + 1}] (${c.sourceName}, v${c.version})\n${c.content}`)
        .join("\n\n---\n\n");

      let parsed: AnswerParse;
      let model: string | null = null;
      try {
        const generation = await this.ai.generate({
          prompt: `Question: ${question}\n\nEvidence:\n${context}`,
          systemPrompt: SYSTEM_PROMPT,
          maxTokens: 1024,
        });
        parsed = this.parseAnswer(generation.text);
        model = generation.model;
      } catch {
        parsed = this.extractiveAnswer(question, chunks);
      }

      const cited = this.citeChunks(parsed.answer, chunks);
      const used = cited.length > 0 ? cited : chunks.slice(0, 3);
      const sources = used.map((c) => this.toCitation(c));
      const confidence = this.computeConfidence(used);

      const response = await this.saveResponse(
        request,
        parsed.answer,
        parsed.status,
        confidence,
        sources,
        chunks,
        model,
      );

      await this.audit(user, {
        action: "query.completed",
        resource: "response",
        resourceId: response.id,
        query: question,
        retrievedSources: chunks.map((c) => ({
          documentId: c.documentId,
          title: c.title,
          version: c.version,
          score: c.score,
        })),
        permissionDecision: "allowed",
        model: model ?? undefined,
      });

      return {
        requestId: request.id,
        conversationId: conversation.id,
        question,
        answer: parsed.answer,
        status: parsed.status,
        confidence,
        sources,
      };
    } catch (err) {
      await this.audit(user, {
        action: "query.failed",
        query: question,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new ServiceUnavailableException(
        "The AI service is currently unavailable.",
      );
    }
  }

  // ---- Internals ----

  private async saveResponse(
    request: { id: string },
    answer: string,
    status: AnswerStatus,
    confidence: number,
    sources: CitationSource[],
    allChunks: RetrievedChunk[],
    model: string | null,
  ) {
    const used = new Set(sources.map((s) => s.documentId));
    const response = await this.prisma.aIResponse.create({
      data: {
        requestId: request.id,
        answer: answer.slice(0, 20000),
        status,
        model: model ?? "no-llm",
        modelVersion: "1",
        confidence,
      },
    });

    const evidence = allChunks.filter((c) => used.has(c.documentId));
    if (evidence.length > 0) {
      await this.prisma.responseEvidence.createMany({
        data: evidence.map((c) => ({
          responseId: response.id,
          documentId: c.documentId,
          versionId: c.versionId,
          chunkId: c.chunkId,
          relevanceScore: c.score,
        })),
      });
    }

    return response;
  }

  private parseAnswer(text: string): AnswerParse {
    const match = text.match(/^\s*STATUS:\s*(\w+)/i);
    let status: AnswerStatus = "answered";
    if (match) {
      const raw = match[1].toLowerCase();
      if (raw === "unknown" || raw === "ambiguous" || raw === "partial") {
        status = raw;
      } else if (raw === "error") {
        status = "error";
      }
    }
    const answer = text.replace(/^\s*STATUS:\s*\w+\s*\n?/i, "").trim();
    return { status, answer };
  }

  private extractiveAnswer(question: string, chunks: RetrievedChunk[]): AnswerParse {
    const preview = chunks
      .slice(0, 3)
      .map((c, i) => `[${i + 1}] ${c.title}: ${c.content.slice(0, 280)}`)
      .join("\n\n");
    return {
      status: "partial",
      answer: `I found authorized evidence for “${question}”, but the language model is not configured, so this is a source-grounded extract rather than a synthesized answer.\n\n${preview}`,
    };
  }

  private citeChunks(answer: string, chunks: RetrievedChunk[]): RetrievedChunk[] {
    const cited = new Set<number>();
    for (const match of answer.matchAll(/\[(\d+)\]/g)) {
      const idx = Number(match[1]) - 1;
      if (idx >= 0 && idx < chunks.length) {
        cited.add(idx);
      }
    }
    return chunks.filter((_c, i) => cited.has(i));
  }

  private toCitation(c: RetrievedChunk): CitationSource {
    return {
      documentId: c.documentId,
      chunkId: c.chunkId,
      title: c.title,
      sourceName: c.sourceName,
      version: c.version,
      score: c.score,
      excerpt: c.content.slice(0, EXCERPT_LENGTH),
      updatedAt: c.updatedAt,
      classification: c.classification as CitationSource["classification"],
    };
  }

  private computeConfidence(cited: RetrievedChunk[]): number {
    if (cited.length === 0) {
      return 0;
    }
    const max = Math.max(...cited.map((c) => c.score));
    return Math.max(0, Math.min(1, max));
  }

  private async audit(
    user: AuthenticatedUser,
    entry: {
      action: string;
      resource?: string;
      resourceId?: string;
      query?: string;
      retrievedSources?: unknown[];
      permissionDecision?: string;
      model?: string;
      error?: string;
    },
  ) {
    await this.prisma.auditLog.create({
      data: {
        tenantId: user.tenantId,
        userId: user.id,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        query: entry.query,
        retrievedSources: entry.retrievedSources
          ? (entry.retrievedSources as object)
          : undefined,
        permissionDecision: entry.permissionDecision,
        model: entry.model,
        error: entry.error,
      },
    });
  }
}