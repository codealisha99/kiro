package com.kiro.api.common;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Prompt injection defense — port of apps/api/src/common/prompt-sanitize.ts.
 * Same 8 patterns, same ⟦data:…⟧ wrapping, same 8000-char cap.
 */
public final class PromptSanitize {

  private PromptSanitize() {}

  private static final List<Pattern> INJECTION_PATTERNS = List.of(
      Pattern.compile("ignore\\s+(all\\s+)?previous\\s+instructions", Pattern.CASE_INSENSITIVE),
      Pattern.compile("ignore\\s+.*system\\s+prompt", Pattern.CASE_INSENSITIVE),
      Pattern.compile("reveal\\s+(confidential|restricted|secret)", Pattern.CASE_INSENSITIVE),
      Pattern.compile("disregard\\s+.*instructions", Pattern.CASE_INSENSITIVE),
      Pattern.compile("you\\s+are\\s+now\\s+(a|an)\\s+", Pattern.CASE_INSENSITIVE),
      Pattern.compile("jailbreak", Pattern.CASE_INSENSITIVE),
      Pattern.compile("DAN\\s+mode", Pattern.CASE_INSENSITIVE),
      Pattern.compile("system\\s*:\\s*you\\s+are", Pattern.CASE_INSENSITIVE));

  public static String sanitizeEvidenceContent(String content) {
    String out = content;
    for (Pattern p : INJECTION_PATTERNS) {
      out = p.matcher(out).replaceAll(m -> "⟦data:" + m.group() + "⟧");
    }
    if (out.length() > 8000) {
      out = out.substring(0, 8000) + " …[truncated]";
    }
    return out;
  }

  public static boolean containsInjection(String content) {
    for (Pattern p : INJECTION_PATTERNS) {
      if (p.matcher(content).find()) return true;
    }
    return false;
  }

  public static String wrapEvidenceBlock(int index, String sourceName, int version, String content) {
    String safe = sanitizeEvidenceContent(content);
    return "[" + index + "] (" + sourceName + ", v" + version + ")\n<<EVIDENCE id=" + index + ">>\n"
        + safe + "\n<</EVIDENCE>>";
  }
}
