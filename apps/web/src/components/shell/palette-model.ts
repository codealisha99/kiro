// Palette entries and matching. Kept free of React so the ranking rules are unit-tested.
export type PaletteGroup = "Ask" | "Navigate" | "Create" | "Preferences" | "Conversations";

export interface PaletteItem {
  id: string;
  group: PaletteGroup;
  label: string;
  keywords?: string;
  shortcut?: string;
}

export interface PaletteEntry extends PaletteItem {
  run: () => void;
}

// Every typed word must match. Labels that start with the first word rank first.
export function filterPaletteItems<T extends PaletteItem>(items: readonly T[], query: string): T[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [...items];
  return items
    .map((item, index) => ({ item, index, rank: rankItem(item, tokens) }))
    .filter((entry): entry is { item: T; index: number; rank: number } => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}

function rankItem(item: PaletteItem, tokens: string[]): number | null {
  const label = item.label.toLowerCase();
  const haystack = `${label} ${(item.keywords ?? "").toLowerCase()} ${item.group.toLowerCase()}`;
  if (!tokens.every((token) => haystack.includes(token))) return null;
  if (label.startsWith(tokens[0])) return 0;
  return label.includes(tokens[0]) ? 1 : 2;
}

export function askEntryLabel(text: string): string {
  return `Ask Kiro: ${text.trim()}`;
}
