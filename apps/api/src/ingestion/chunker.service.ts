import { Inject, Injectable } from "@nestjs/common";

export const CHUNKER_CHUNK_SIZE = "CHUNKER_CHUNK_SIZE";
export const CHUNKER_OVERLAP = "CHUNKER_OVERLAP";

export interface RawChunk {
  index: number;
  content: string;
}

/**
 * Splits text into overlapping chunks. Block-based so it stays
 * deterministic and testable (no LLM/embedding dependency).
 */
@Injectable()
export class ChunkerService {
  constructor(
    @Inject(CHUNKER_CHUNK_SIZE) private readonly chunkSize = 1000,
    @Inject(CHUNKER_OVERLAP) private readonly overlap = 200,
  ) {}

  chunk(text: string): RawChunk[] {
    const normalized = text.replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return [];
    }

    const paragraphs = normalized.split(/\n\s*\n/).filter((p) => p.trim());

    const chunks: string[] = [];
    let buffer = "";
    for (const paragraph of paragraphs) {
      if ((buffer + "\n" + paragraph).trim().length <= this.chunkSize) {
        buffer = (buffer + "\n" + paragraph).trim();
        continue;
      }
      if (buffer) {
        chunks.push(buffer);
      }
      if (paragraph.length > this.chunkSize) {
        // Break oversized paragraphs by sentence/word boundaries.
        chunks.push(...this.splitLong(paragraph));
        buffer = "";
      } else {
        buffer = paragraph;
      }
    }
    if (buffer) {
      chunks.push(buffer);
    }

    if (this.overlap > 0 && chunks.length > 1) {
      return chunks.map((content, i) => {
        if (i === 0) {
          return { index: i, content };
        }
        const prev = chunks[i - 1];
        const tail = prev.slice(-this.overlap);
        return { index: i, content: `${tail}\n${content}` };
      });
    }
    return chunks.map((content, i) => ({ index: i, content }));
  }

  private splitLong(text: string): string[] {
    const parts = text.split(/(?<=[.!?\n])\s+/);
    const out: string[] = [];
    let buffer = "";
    const flush = (chunk: string) => {
      out.push(chunk);
    };
    for (const part of parts) {
      if ((buffer + " " + part).trim().length <= this.chunkSize) {
        buffer = (buffer + " " + part).trim();
        continue;
      }
      if (buffer) {
        flush(buffer);
        buffer = "";
      }
      if (part.length > this.chunkSize) {
        // Hard-slice unbroken runs (no punctuation/newlines available).
        for (let i = 0; i < part.length; i += this.chunkSize) {
          flush(part.slice(i, i + this.chunkSize));
        }
      } else {
        buffer = part;
      }
    }
    if (buffer) {
      flush(buffer);
    }
    return out;
  }
}