package com.kiro.api.ingestion;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import org.junit.jupiter.api.Test;

class ChunkerServiceTest {

  private final ChunkerService chunker = new ChunkerService(1000, 200);

  @Test
  void emptyTextProducesNoChunks() {
    assertTrue(chunker.chunk("   \r\n  ").isEmpty());
  }

  @Test
  void shortTextIsSingleChunk() {
    List<ChunkerService.RawChunk> out = chunker.chunk("Hello world.");
    assertEquals(1, out.size());
    assertEquals(0, out.get(0).index());
    assertEquals("Hello world.", out.get(0).content());
  }

  @Test
  void paragraphsPackUpToChunkSize() {
    String text = "Para one.\n\nPara two.\n\nPara three.";
    List<ChunkerService.RawChunk> out = chunker.chunk(text);
    assertEquals(1, out.size());
  }

  @Test
  void longParagraphSplitsAndOverlaps() {
    String sentence = "This is a sentence about Northwind trading policies. ";
    String text = sentence.repeat(60); // ~3000 chars, one paragraph
    List<ChunkerService.RawChunk> out = chunker.chunk(text);
    assertTrue(out.size() > 1);
    for (ChunkerService.RawChunk c : out) {
      assertTrue(c.content().length() <= 1000 + 200, "chunk too big: " + c.content().length());
    }
    // overlap: chunk 2 starts with tail of chunk 1
    String prev = out.get(0).content();
    String tail = prev.substring(Math.max(0, prev.length() - 200));
    assertTrue(out.get(1).content().startsWith(tail));
  }

  @Test
  void indicesAreSequential() {
    String text = ("Paragraph number one is here.\n\n").repeat(40);
    List<ChunkerService.RawChunk> out = chunker.chunk(text);
    for (int i = 0; i < out.size(); i++) assertEquals(i, out.get(i).index());
  }

  @Test
  void normalizesCrlf() {
    List<ChunkerService.RawChunk> out = chunker.chunk("a\r\n\r\nb");
    assertEquals(1, out.size());
    assertFalse(out.get(0).content().contains("\r"));
  }
}
