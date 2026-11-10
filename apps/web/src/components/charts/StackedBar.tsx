import type { ReactNode } from "react";
import { ChartDataTable, ChartFrame } from "./ChartFrame";
import { TONE_COLORS, type ChartTone } from "./chart-format";
import { formatNumber, formatPercent } from "./scale";

export interface StackedSegment {
  id: string;
  label: string;
  value: number;
  /** Status tones carry meaning (good, warning, danger); accent and neutral are for plain categories. */
  tone?: ChartTone;
}

// A single 100% bar for distributions such as goal health or task status. Always paired with a legend.
export function StackedBar({
  title,
  description,
  segments,
  loading = false,
  emptyText,
  footer,
}: {
  title: string;
  description?: string;
  segments: StackedSegment[];
  loading?: boolean;
  emptyText?: string;
  footer?: ReactNode;
}) {
  const clean = segments.map((segment) => ({ ...segment, value: Number.isFinite(segment.value) && segment.value > 0 ? segment.value : 0 }));
  const total = clean.reduce((sum, segment) => sum + segment.value, 0);
  const empty = total === 0;
  const shares = clean.map((segment) => (total === 0 ? null : segment.value / total));
  const summary = clean.map((segment) => `${segment.label} ${formatNumber(segment.value)}`).join(", ");
  const table = (
    <ChartDataTable
      caption={`${title}, counts and shares`}
      columns={["Segment", "Count", "Share"]}
      rows={clean.map((segment, i) => [segment.label, formatNumber(segment.value), formatPercent(shares[i])])}
    />
  );
  return (
    <ChartFrame title={title} description={description} loading={loading} empty={empty} emptyText={emptyText ?? "Nothing recorded yet."} table={table} footer={footer}>
      <div className="stacked-bar-wrap">
        <div className="stacked-bar" role="img" aria-label={`${title}: ${summary}`}>
          {clean.map((segment, i) =>
            segment.value > 0 ? (
              <span key={segment.id} className="stacked-segment" style={{ width: `${(shares[i] ?? 0) * 100}%`, background: TONE_COLORS[segment.tone ?? "accent"] }} />
            ) : null,
          )}
        </div>
        <ul className="stacked-legend" aria-label={`${title} legend`}>
          {clean.map((segment, i) => (
            <li key={segment.id}>
              <span className="chart-key-swatch" style={{ background: TONE_COLORS[segment.tone ?? "accent"] }} aria-hidden="true" />
              <span className="stacked-legend-label">{segment.label}</span>
              <span className="stacked-legend-count">{formatNumber(segment.value)}</span>
              <span className="stacked-legend-share">{formatPercent(shares[i])}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFrame>
  );
}
