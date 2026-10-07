import {
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

// Must match the vector(1536) column in the database migrations.
const EMBEDDING_DIMENSIONS = 1536;
const embedResultSchema = z.object({
  embeddings: z.array(z.array(z.number().finite()).length(EMBEDDING_DIMENSIONS)),
  model: z.string().min(1),
  dimensions: z.literal(EMBEDDING_DIMENSIONS),
});
const generateResultSchema = z.object({
  text: z.string(),
  model: z.string().min(1),
  model_version: z.string().min(1),
  usage: z.record(z.number().finite().nonnegative()),
});
const gatewayStatusSchema = z.object({
  llm_provider: z.string(),
  embedding_provider: z.string(),
  providers: z.array(z.object({
    name: z.string(),
    kind: z.enum(["llm", "embedding"]),
    model: z.string(),
    configured: z.boolean(),
  })),
});

export interface EmbedResult {
  embeddings: number[][];
  model: string;
  dimensions: number;
}

export interface GenerateArgs {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  modelVersion: string;
  usage: Record<string, number>;
}

export interface GatewayStatus {
  llmProvider: string;
  embeddingProvider: string;
  providers: { name: string; kind: "llm" | "embedding"; model: string; configured: boolean }[];
}

@Injectable()
export class AiGatewayService {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>("AI_SERVICE_URL", "http://localhost:8000")
      .replace(/\/+$/, "");
  }

  async embedTexts(texts: string[]): Promise<EmbedResult> {
    const body = await this.request("/embed", embedResultSchema, { texts });
    if (body.embeddings.length !== texts.length) {
      throw new ServiceUnavailableException("AI service returned an incomplete embedding batch");
    }
    return body;
  }

  async generate(args: GenerateArgs): Promise<GenerateResult> {
    const body = await this.request("/generate", generateResultSchema, {
      prompt: args.prompt,
      system_prompt: args.systemPrompt,
      model: args.model,
      max_tokens: args.maxTokens,
      temperature: args.temperature,
    });
    return {
      text: body.text,
      model: body.model,
      modelVersion: body.model_version,
      usage: body.usage,
    };
  }

  async status(): Promise<GatewayStatus> {
    const body = await this.request("/gateway", gatewayStatusSchema, undefined, "GET");
    return {
      llmProvider: body.llm_provider,
      embeddingProvider: body.embedding_provider,
      providers: body.providers,
    };
  }

  private async request<T>(path: string, schema: z.ZodType<T>, payload: unknown, method: "POST" | "GET" = "POST"): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "POST" ? JSON.stringify(payload) : undefined,
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      throw new ServiceUnavailableException(
        `AI service unreachable at ${this.baseUrl}${path}`,
      );
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new ServiceUnavailableException(
        `AI service error (${res.status}): ${detail.slice(0, 300)}`,
      );
    }
    try {
      return schema.parse(await res.json());
    } catch {
      throw new ServiceUnavailableException("AI service returned an invalid response");
    }
  }
}
