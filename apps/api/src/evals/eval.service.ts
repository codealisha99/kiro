import { Injectable } from "@nestjs/common";
import * as fs from "node:fs";
import * as path from "node:path";
import { RetrievalService } from "../retrieval/retrieval.service";
import { BrainService } from "../brain/brain.service";
import type { AuthenticatedUser } from "../auth/jwt-payload.interface";

interface GoldenCase {
  id: string;
  query: string;
  expectedDocuments: string[];
  expectedAnswerContains?: string[];
  type: string;
  expectUnknown?: boolean;
}

export interface EvalResult {
  id: string;
  query: string;
  type: string;
  retrieved: string[];
  expected: string[];
  hit: boolean;
  answerOk?: boolean;
  answer?: string;
  status?: string;
}

@Injectable()
export class EvalService {
  constructor(
    private readonly retrieval: RetrievalService,
    private readonly brain: BrainService,
  ) {}

  private loadGolden(): GoldenCase[] {
    const p = path.join(process.cwd(), "evals", "golden.json");
    const alt = path.join(__dirname, "../../evals/golden.json");
    const file = fs.existsSync(p) ? p : alt;
    return JSON.parse(fs.readFileSync(file, "utf8")) as GoldenCase[];
  }

  async runRetrieval(user: AuthenticatedUser) {
    const cases = this.loadGolden();
    const results: EvalResult[] = [];
    for (const c of cases) {
      const chunks = await this.retrieval.search(user, c.query, 5);
      // Map chunk -> externalKey via title heuristic (demo corpus title contains key)
      const retrieved = [...new Set(chunks.map((ch) => ch.title.toLowerCase()))];
      // Check hit: at least one expected doc's title words appear
      const hit = c.expectedDocuments.length === 0
        ? chunks.length === 0
        : c.expectedDocuments.some((exp) => retrieved.some((t) => t.includes(exp.replace(/-/g, " ").split(" ")[0])));
      results.push({ id: c.id, query: c.query, type: c.type, retrieved, expected: c.expectedDocuments, hit });
    }
    const hits = results.filter((r) => r.hit).length;
    return {
      total: results.length,
      hits,
      hitRate: results.length ? hits / results.length : 0,
      recallAt5: hits / Math.max(1, results.filter((r) => r.expected.length).length),
      results,
    };
  }

  async runRag(user: AuthenticatedUser) {
    const cases = this.loadGolden();
    const results: EvalResult[] = [];
    for (const c of cases) {
      const res = await this.brain.query(user, { query: c.query });
      const answerOk = c.expectUnknown
        ? res.status === "unknown"
        : (c.expectedAnswerContains ?? []).some((frag) => res.answer.toLowerCase().includes(frag.toLowerCase()));
      results.push({
        id: c.id,
        query: c.query,
        type: c.type,
        retrieved: res.sources.map((s) => s.title),
        expected: c.expectedDocuments,
        hit: answerOk ?? true,
        answerOk,
        answer: res.answer.slice(0, 400),
        status: res.status,
      });
    }
    const ok = results.filter((r) => r.answerOk).length;
    return { total: results.length, ok, accuracy: ok / results.length, results };
  }
}
