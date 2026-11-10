import type { DocumentListItem } from "@kiro/shared";

export type AccessFilter = "all" | "internal" | "public" | "confidential" | "restricted";
export type LibrarySort = "updated" | "title";
export type Tone = "success" | "warning" | "danger" | "neutral" | "info";

export const ACCESS_FILTERS: { id: AccessFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "internal", label: "Workspace" },
  { id: "public", label: "Public" },
  { id: "confidential", label: "Confidential" },
  { id: "restricted", label: "Restricted" },
];

export function accessLabel(classification: string): string {
  switch (classification) {
    case "internal":
      return "Workspace";
    case "public":
      return "Public";
    case "confidential":
      return "Confidential";
    case "restricted":
      return "Restricted";
    default:
      return classification;
  }
}

export function accessTone(classification: string): Tone {
  if (classification === "restricted") return "warning";
  if (classification === "confidential") return "info";
  return "neutral";
}

export function documentStatusLabel(status: string): string {
  return status === "draft" ? "Draft" : status === "published" ? "Published" : status === "archived" ? "Archived" : status;
}

export function documentStatusTone(status: string): Tone {
  return status === "published" ? "success" : "neutral";
}

export function filterDocuments(
  documents: readonly DocumentListItem[],
  sourceNames: ReadonlyMap<string, string>,
  query: { search: string; access: AccessFilter },
): DocumentListItem[] {
  const needle = query.search.trim().toLowerCase();
  return documents.filter(
    (doc) =>
      `${doc.title} ${sourceNames.get(doc.sourceId) ?? ""}`.toLowerCase().includes(needle) &&
      (query.access === "all" || doc.classification === query.access),
  );
}

export function sortDocuments(documents: readonly DocumentListItem[], sort: LibrarySort): DocumentListItem[] {
  return [...documents].sort((a, b) =>
    sort === "title"
      ? a.title.localeCompare(b.title)
      : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
}

export function accessCounts(documents: readonly DocumentListItem[]): Record<AccessFilter, number> {
  const counts: Record<AccessFilter, number> = { all: documents.length, internal: 0, public: 0, confidential: 0, restricted: 0 };
  for (const doc of documents) {
    if (doc.classification in counts) counts[doc.classification as Exclude<AccessFilter, "all">] += 1;
  }
  return counts;
}

const DAY_MS = 86_400_000;

/** How recently each document changed: within 30 days, within six months, or older. */
export function freshnessSegments(documents: readonly Pick<DocumentListItem, "updatedAt">[], nowMs: number) {
  const counts = { recent: 0, aging: 0, stale: 0 };
  for (const d of documents) {
    const age = (nowMs - new Date(d.updatedAt).getTime()) / DAY_MS;
    if (age <= 30) counts.recent += 1;
    else if (age <= 182) counts.aging += 1;
    else counts.stale += 1;
  }
  return [
    { id: "recent", label: "Updated in the last 30 days", value: counts.recent, tone: "good" as const },
    { id: "aging", label: "1 to 6 months old", value: counts.aging, tone: "warning" as const },
    { id: "stale", label: "Older than 6 months", value: counts.stale, tone: "danger" as const },
  ];
}
