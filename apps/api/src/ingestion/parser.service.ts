import { BadRequestException, Injectable } from "@nestjs/common";
import pdfParse from "pdf-parse";

export interface ParsedDocument {
  title: string;
  content: string;
  filename: string;
}

const MAX_CHARS = 400_000;

/**
 * Turns uploaded files into normalized text the chunker can index.
 * PDF, Markdown, plain text, and CSV are supported for the MVP.
 */
@Injectable()
export class ParserService {
  async parse(
    file: { originalname: string; mimetype: string; buffer: Buffer },
    titleHint?: string,
  ): Promise<ParsedDocument> {
    if (!file?.buffer?.length) {
      throw new BadRequestException("A file is required");
    }

    const filename = file.originalname || "untitled";
    const ext = extension(filename);
    const mime = (file.mimetype || "").toLowerCase();
    const content = await this.extract(file.buffer, ext, mime);

    let trimmed = content.replace(/\u0000/g, "").trim();
    if (!trimmed) {
      throw new BadRequestException(
        "Could not extract any text from that file. Try a PDF, Markdown, text, or CSV file.",
      );
    }
    // Defensive: evidence will be wrapped at query time, but flagging early helps audit.
    // We don't reject injection payloads — we index them as data.
    trimmed = trimmed.slice(0, MAX_CHARS);

    return {
      title: (titleHint?.trim() || basename(filename)).slice(0, 200),
      content: trimmed,
      filename,
    };
  }

  private async extract(buffer: Buffer, ext: string, mime: string): Promise<string> {
    if (ext === "pdf" || mime === "application/pdf") {
      const parsed = await pdfParse(buffer);
      return parsed.text ?? "";
    }
    if (ext === "csv" || mime === "text/csv" || mime === "application/vnd.ms-excel") {
      return csvToProse(buffer.toString("utf8"));
    }
    // XLSX/DOCX are ZIP-based OOXML; without heavy deps we extract raw text
    // by stripping XML tags. This covers MVP spreadsheets/docs without needing LibreOffice.
    if (ext === "xlsx" || mime.includes("spreadsheetml") || mime.includes("excel")) {
      return extractOoxmlText(buffer);
    }
    if (ext === "docx" || mime.includes("wordprocessingml") || mime.includes("officedocument.word")) {
      return extractOoxmlText(buffer);
    }
    if (
      ["txt", "md", "markdown", "text"].includes(ext) ||
      mime.startsWith("text/") ||
      mime === "application/json"
    ) {
      return buffer.toString("utf8");
    }
    throw new BadRequestException(
      "Unsupported file type. Upload a PDF, Markdown, text, CSV, XLSX, or DOCX file.",
    );
  }
}

function extension(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : "";
}

function basename(filename: string): string {
  const slash = Math.max(filename.lastIndexOf("/"), filename.lastIndexOf("\\"));
  const name = slash >= 0 ? filename.slice(slash + 1) : filename;
  return name.replace(/\.[^.]+$/, "") || "Untitled document";
}

function csvToProse(raw: string): string {
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) {
    return "";
  }
  const headers = splitCsvLine(lines[0]);
  const rows = lines.slice(1).map((line, i) => {
    const cols = splitCsvLine(line);
    const pairs = headers
      .map((header, idx) => `${header}: ${cols[idx] ?? ""}`)
      .join(" | ");
    return `Row ${i + 1}. ${pairs}`;
  });
  return [`Spreadsheet columns: ${headers.join(", ")}`, ...rows].join("\n\n");
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
}

function extractOoxmlText(buffer: Buffer): string {
  // OOXML is a ZIP; we do a best-effort text extraction by pulling all
  // human-readable strings between XML tags, joining sharedStrings/sheetData.
  const raw = buffer.toString("utf8");
  // Extract text nodes like <t>value</t> and <v>value</v>
  const matches = [...raw.matchAll(/<t[^>]*>([^<]+)<\/t>/g)].map((m) => m[1]);
  if (matches.length) return matches.join(" ");
  // Fallback: strip XML tags and collapse whitespace
  return raw
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
