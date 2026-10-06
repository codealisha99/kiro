package com.kiro.api.ingestion;

import java.util.ArrayList;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Deterministic block-based chunker — port of ChunkerService (1000/200 defaults).
 * Paragraph-pack, oversized paragraphs split by sentence, hard-slice fallback,
 * then previous-chunk-tail overlap. No LLM/embedding dependency.
 */
@Service
public class ChunkerService {

  private final int chunkSize;
  private final int overlap;

  @org.springframework.beans.factory.annotation.Autowired
  public ChunkerService(com.kiro.api.config.AppProperties props) {
    this(props.chunkSize(), props.chunkOverlap());
  }

  ChunkerService(int chunkSize, int overlap) {
    this.chunkSize = chunkSize;
    this.overlap = overlap;
  }

  public record RawChunk(int index, String content) {}

  public List<RawChunk> chunk(String text) {
    String normalized = text.replace("\r\n", "\n").trim();
    if (normalized.isEmpty()) return List.of();

    List<String> paragraphs = new ArrayList<>();
    for (String p : normalized.split("\n\\s*\n")) {
      if (!p.trim().isEmpty()) paragraphs.add(p);
    }

    List<String> chunks = new ArrayList<>();
    String buffer = "";
    for (String paragraph : paragraphs) {
      String combined = (buffer + "\n" + paragraph).trim();
      if (combined.length() <= chunkSize) {
        buffer = combined;
        continue;
      }
      if (!buffer.isEmpty()) chunks.add(buffer);
      if (paragraph.length() > chunkSize) {
        chunks.addAll(splitLong(paragraph));
        buffer = "";
      } else {
        buffer = paragraph;
      }
    }
    if (!buffer.isEmpty()) chunks.add(buffer);

    List<RawChunk> out = new ArrayList<>();
    for (int i = 0; i < chunks.size(); i++) {
      String content = chunks.get(i);
      if (overlap > 0 && chunks.size() > 1 && i > 0) {
        String prev = chunks.get(i - 1);
        String tail = prev.substring(Math.max(0, prev.length() - overlap));
        content = tail + "\n" + content;
      }
      out.add(new RawChunk(i, content));
    }
    return out;
  }

  private List<String> splitLong(String text) {
    String[] parts = text.split("(?<=[.!?\\n])\\s+");
    List<String> out = new ArrayList<>();
    String buffer = "";
    for (String part : parts) {
      String combined = (buffer + " " + part).trim();
      if (combined.length() <= chunkSize) {
        buffer = combined;
        continue;
      }
      if (!buffer.isEmpty()) {
        out.add(buffer);
        buffer = "";
      }
      if (part.length() > chunkSize) {
        for (int i = 0; i < part.length(); i += chunkSize) {
          out.add(part.substring(i, Math.min(part.length(), i + chunkSize)));
        }
      } else {
        buffer = part;
      }
    }
    if (!buffer.isEmpty()) out.add(buffer);
    return out;
  }
}
