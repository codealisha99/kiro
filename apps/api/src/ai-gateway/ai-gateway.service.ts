import {
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

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

/**
 * Thin HTTP client for the Python AI service (embeddings + generation).
 * Keeps the NestJS backend provider-agnostic — the AI service owns the gateway.
 */
@Injectable()
export class AiGatewayService {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.baseUrl = config
      .get<string>("AI_SERVICE_URL", "http://localhost:8000")
      .replace(/\/+$/, "");
  }

  async embedTexts(texts: string[]): Promise<EmbedResult> {
    const body = await this.post<{
      embeddings: number[][];
      model: string;
      dimensions: number;
    }>("/embed", { texts });
    return body;
  }

  async generate(args: GenerateArgs): Promise<GenerateResult> {
    const body = await this.post<
      GenerateResult & { model_version: string }
    >("/generate", {
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
    const body = await this.post<GatewayStatus>("/gateway", {}, "GET");
    return body;
  }

  private async post<T>(path: string, payload: unknown, method: "POST" | "GET" = "POST"): Promise<T> {
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
    return (await res.json()) as T;
  }
}