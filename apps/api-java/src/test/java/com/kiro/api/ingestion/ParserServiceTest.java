package com.kiro.api.ingestion;

import static org.junit.jupiter.api.Assertions.*;

import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class ParserServiceTest {

  private final ParserService parser = new ParserService();

  private byte[] bytes(String s) {
    return s.getBytes(StandardCharsets.UTF_8);
  }

  @Test
  void parsesPlainText() {
    var doc = parser.parse(bytes("hello world"), "notes.txt", "text/plain", null);
    assertEquals("hello world", doc.content());
    assertEquals("notes", doc.title());
    assertEquals("notes.txt", doc.filename());
  }

  @Test
  void titleHintWinsOverFilename() {
    var doc = parser.parse(bytes("abc"), "file.md", "text/markdown", "Custom title");
    assertEquals("Custom title", doc.title());
  }

  @Test
  void csvBecomesProse() {
    String csv = "name,amount\nacme,42\n\"foo, bar\",7";
    var doc = parser.parse(bytes(csv), "sheet.csv", "text/csv", null);
    assertTrue(doc.content().contains("Spreadsheet columns: name, amount"));
    assertTrue(doc.content().contains("Row 1. name: acme | amount: 42"));
    assertTrue(doc.content().contains("foo, bar"));
  }

  @Test
  void emptyFileIsRejected() {
    ResponseStatusException e = assertThrows(ResponseStatusException.class,
        () -> parser.parse(new byte[0], "x.txt", "text/plain", null));
    assertEquals(400, e.getStatusCode().value());
  }

  @Test
  void whitespaceOnlyIsRejected() {
    assertThrows(ResponseStatusException.class,
        () -> parser.parse(bytes("   \n "), "x.txt", "text/plain", null));
  }

  @Test
  void unsupportedTypeIsRejected() {
    ResponseStatusException e = assertThrows(ResponseStatusException.class,
        () -> parser.parse(bytes("binary-pretend"), "photo.png", "image/png", null));
    assertTrue(e.getReason().contains("Unsupported file type"));
  }

  @Test
  void capsAtMaxChars() {
    var doc = parser.parse(bytes("y".repeat(500_000)), "big.txt", "text/plain", null);
    assertEquals(400_000, doc.content().length());
  }

  @Test
  void stripsNulBytes() {
    var doc = parser.parse(bytes("ab\u0000cd"), "x.txt", "text/plain", null);
    assertEquals("abcd", doc.content());
  }
  @Test
  void corruptedSpreadsheetIsRejectedInsteadOfIndexingBinaryGarbage() {
    assertThrows(ResponseStatusException.class,
        () -> parser.parse(bytes("broken binary workbook"), "sheet.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", null));
  }

  @Test
  void extractsRealWordAndSpreadsheetUploads() throws Exception {
    try (var workbook = new org.apache.poi.xssf.usermodel.XSSFWorkbook();
         var output = new java.io.ByteArrayOutputStream()) {
      workbook.createSheet("Policies").createRow(0).createCell(0).setCellValue("Travel expenses 14 days");
      workbook.write(output);
      assertTrue(parser.parse(output.toByteArray(), "policy.xlsx", "", null).content().contains("14 days"));
    }
    try (var document = new org.apache.poi.xwpf.usermodel.XWPFDocument();
         var output = new java.io.ByteArrayOutputStream()) {
      document.createParagraph().createRun().setText("Travel expenses 14 days");
      document.write(output);
      assertTrue(parser.parse(output.toByteArray(), "policy.docx", "", null).content().contains("14 days"));
    }
  }

}
