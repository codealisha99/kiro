// Shared x-axis and value formatting. Dates are formatted in UTC so server and client render identically.
export function formatDayShort(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatDayLong(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function slotColor(index: number): string {
  return `var(--chart-${(index % 8) + 1})`;
}

export function sequentialColor(step: 1 | 2 | 3 | 4 | 5): string {
  return `var(--chart-seq-${step})`;
}

export type ChartTone = "accent" | "good" | "warning" | "danger" | "neutral";

export const TONE_COLORS: Record<ChartTone, string> = {
  accent: "var(--chart-1)",
  good: "var(--color-success)",
  warning: "var(--color-warning)",
  danger: "var(--color-danger)",
  neutral: "var(--chart-axis)",
};
