const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /ignore\s+.*system\s+prompt/gi,
  /reveal\s+(confidential|restricted|secret)/gi,
  /disregard\s+.*instructions/gi,
  /you\s+are\s+now\s+(a|an)\s+/gi,
  /jailbreak/gi,
  /DAN\s+mode/gi,
  /system\s*:\s*you\s+are/gi,
];

export function sanitizeEvidenceContent(content: string): string {
  let out = content;

  for (const re of INJECTION_PATTERNS) {
    out = out.replace(re, (m) => `⟦data:${m}⟧`);
  }

  if (out.length > 8000) {
    out = out.slice(0, 8000) + " …[truncated]";
  }

  return out;
}

export function containsInjection(content: string): boolean {
  return INJECTION_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(content);
  });
}

export function wrapEvidenceBlock(index: number, sourceName: string, version: number, content: string): string {
  const safe = sanitizeEvidenceContent(content);
  return `[${index}] (${sourceName}, v${version})\n<<EVIDENCE id=${index}>>\n${safe}\n<</EVIDENCE>>`;
}
