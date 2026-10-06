package com.kiro.api.ingestion;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.DataFormatter;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

/**
 * Upload parser — port of ParserService. PDF via PDFBox, DOCX/XLSX via POI,
 * CSV→prose and TXT/MD raw. Same MAX_CHARS cap, NUL-strip, error messages.
 */
@Service
public class ParserService {

  private static final Logger log = LoggerFactory.getLogger(ParserService.class);
  static final int MAX_CHARS = 400_000;

  public record ParsedDocument(String title, String content, String filename) {}

  public ParsedDocument parse(byte[] bytes, String originalName, String mime, String titleHint) {
    if (bytes == null || bytes.length == 0) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "A file is required");
    }
    String filename = (originalName == null || originalName.isBlank()) ? "untitled" : originalName;
    String ext = extension(filename);
    String mimeLower = (mime == null ? "" : mime.toLowerCase());
    String content;
    try {
      content = extract(bytes, ext, mimeLower);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      log.warn("Parse failed for {}: {}", filename, e.toString());
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Could not extract any text from that file. Try a PDF, Markdown, text, or CSV file.");
    }
    String trimmed = content.replace("\u0000", "").trim();
    if (trimmed.isEmpty()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
          "Could not extract any text from that file. Try a PDF, Markdown, text, or CSV file.");
    }
    // Indexed as data even if it looks like an injection payload (same as NestJS).
    if (trimmed.length() > MAX_CHARS) trimmed = trimmed.substring(0, MAX_CHARS);
    String title = (titleHint != null && !titleHint.isBlank() ? titleHint.trim() : basename(filename));
    if (title.length() > 200) title = title.substring(0, 200);
    return new ParsedDocument(title, trimmed, filename);
  }

  private String extract(byte[] bytes, String ext, String mime) throws IOException {
    if ("pdf".equals(ext) || "application/pdf".equals(mime)) {
      try (PDDocument doc = PDDocument.load(bytes)) {
        return new PDFTextStripper().getText(doc);
      }
    }
    if ("csv".equals(ext) || "text/csv".equals(mime) || "application/vnd.ms-excel".equals(mime)) {
      return csvToProse(new String(bytes, java.nio.charset.StandardCharsets.UTF_8));
    }
    if ("xlsx".equals(ext) || mime.contains("spreadsheetml") || mime.contains("excel")) {
      return extractSpreadsheet(bytes);
    }
    if ("docx".equals(ext) || mime.contains("wordprocessingml") || mime.contains("officedocument.word")) {
      try (XWPFDocument doc = new XWPFDocument(new ByteArrayInputStream(bytes));
          XWPFWordExtractor ex = new XWPFWordExtractor(doc)) {
        return ex.getText();
      }
    }
    if (List.of("txt", "md", "markdown", "text").contains(ext)
        || mime.startsWith("text/")
        || "application/json".equals(mime)) {
      return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
    }
    throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
        "Unsupported file type. Upload a PDF, Markdown, text, CSV, XLSX, or DOCX file.");
  }

  private String extractSpreadsheet(byte[] bytes) throws IOException {
    try (Workbook wb = WorkbookFactory.create(new ByteArrayInputStream(bytes))) {
      DataFormatter fmt = new DataFormatter();
      StringBuilder sb = new StringBuilder();
      for (Sheet sheet : wb) {
        for (Row row : sheet) {
          List<String> cells = new ArrayList<>();
          for (Cell cell : row) cells.add(fmt.formatCellValue(cell));
          if (cells.stream().anyMatch(c -> !c.isBlank())) sb.append(String.join(" | ", cells)).append('\n');
        }
      }
      return sb.toString().trim();
    } catch (Exception e) {
      // Best-effort OOXML fallback (mirrors the NestJS tag-strip fallback).
      String raw = new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
      java.util.regex.Matcher m = java.util.regex.Pattern.compile("<t[^>]*>([^<]+)</t>").matcher(raw);
      StringBuilder sb = new StringBuilder();
      while (m.find()) sb.append(m.group(1)).append(' ');
      if (!sb.isEmpty()) return sb.toString();
      return raw.replaceAll("<[^>]+>", " ").replaceAll("\\s+", " ").trim();
    }
  }

  static String csvToProse(String raw) {
    List<String> lines = new ArrayList<>();
    for (String l : raw.split("\r?\n")) {
      if (!l.trim().isEmpty()) lines.add(l);
    }
    if (lines.isEmpty()) return "";
    List<String> headers = splitCsvLine(lines.get(0));
    StringBuilder sb = new StringBuilder("Spreadsheet columns: " + String.join(", ", headers));
    for (int i = 1; i < lines.size(); i++) {
      List<String> cols = splitCsvLine(lines.get(i));
      List<String> pairs = new ArrayList<>();
      for (int j = 0; j < headers.size(); j++) {
        pairs.add(headers.get(j) + ": " + (j < cols.size() ? cols.get(j) : ""));
      }
      sb.append("\n\nRow ").append(i).append(". ").append(String.join(" | ", pairs));
    }
    return sb.toString();
  }

  static List<String> splitCsvLine(String line) {
    List<String> out = new ArrayList<>();
    StringBuilder cur = new StringBuilder();
    boolean quoted = false;
    for (int i = 0; i < line.length(); i++) {
      char ch = line.charAt(i);
      if (ch == '"') {
        if (quoted && i + 1 < line.length() && line.charAt(i + 1) == '"') {
          cur.append('"');
          i++;
        } else {
          quoted = !quoted;
        }
        continue;
      }
      if (ch == ',' && !quoted) {
        out.add(cur.toString().trim());
        cur.setLength(0);
        continue;
      }
      cur.append(ch);
    }
    out.add(cur.toString().trim());
    return out;
  }

  private static String extension(String filename) {
    int idx = filename.lastIndexOf('.');
    return idx >= 0 ? filename.substring(idx + 1).toLowerCase() : "";
  }

  private static String basename(String filename) {
    int slash = Math.max(filename.lastIndexOf('/'), filename.lastIndexOf('\\'));
    String name = slash >= 0 ? filename.substring(slash + 1) : filename;
    String base = name.replaceAll("\\.[^.]+$", "");
    return base.isEmpty() ? "Untitled document" : base;
  }
}
