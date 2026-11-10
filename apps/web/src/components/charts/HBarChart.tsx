import type { ReactNode } from "react";
import { ChartDataTable, ChartFrame } from "./ChartFrame";
import { formatNumber } from "./scale";

export interface HBarItem {
  id: string;
  label: string;
  value: number | null;
  /** Optional context shown under the label, such as a team or count basis. */
  detail?: string;
}

// Horizontal bars for rankings. One series, so every bar uses the first categorical slot.
export function HBarChart({
  title,
  description,
  items,
  valueFormat = formatNumber,
  loading = false,
  emptyText,
  footer,
}: {
  title: string;
  description?: string;
  items: HBarItem[];
  valueFormat?: (value: number) => string;
  loading?: boolean;
  emptyText?: string;
  footer?: ReactNode;
}) {
  const numeric = items.flatMap((item) => (item.value !== null && Number.isFinite(item.value) ? [item.value] : []));
  const max = Math.max(0, ...numeric);
  const empty = items.length === 0 || numeric.length === 0;
  const table = (
    <ChartDataTable
      caption={`${title}, ranked`}
      columns={["Name", "Value"]}
      rows={items.map((item) => [item.detail ? `${item.label} (${item.detail})` : item.label, item.value === null ? null : valueFormat(item.value)])}
    />
  );
  return (
    <ChartFrame title={title} description={description} loading={loading} empty={empty} emptyText={emptyText ?? "Nothing to rank yet."} table={table} footer={footer}>
      <ol className="hbar-list">
        {items.map((item) => {
          const percent = item.value === null || max === 0 ? 0 : Math.max(0, (item.value / max) * 100);
          return (
            <li key={item.id} className="hbar-row">
              <span className="hbar-label">
                <span>{item.label}</span>
                {item.detail && <small>{item.detail}</small>}
              </span>
              <span className="hbar-track" aria-hidden="true">
                <span className="hbar-fill" style={{ width: `${percent}%` }} />
              </span>
              <span className="hbar-value">{item.value === null ? "No data" : valueFormat(item.value)}</span>
            </li>
          );
        })}
      </ol>
    </ChartFrame>
  );
}
