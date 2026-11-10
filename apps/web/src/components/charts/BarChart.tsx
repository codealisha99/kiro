"use client";

import { useState, type ReactNode } from "react";
import { ChartDataTable, ChartFrame } from "./ChartFrame";
import { slotColor } from "./chart-format";
import { useChartWidth } from "./use-chart-width";
import { formatCompact, formatNumber, linearScale, niceDomain, niceTicks, stackOffsets } from "./scale";

export interface BarSeries {
  id: string;
  label: string;
  /** One value per category, in category order. Null means no data. Negative values draw square. */
  values: readonly (number | null)[];
}

const MARGIN = { top: 16, right: 8, bottom: 28, left: 48 };
const MAX_BAR = 24;
const GAP = 2;
const RADIUS = 4;

export interface BarChartProps {
  title: string;
  description?: string;
  categories: readonly string[];
  /** Up to four series. Grouped by default; set stacked to stack them. */
  series: BarSeries[];
  stacked?: boolean;
  yFormat?: (value: number) => string;
  valueFormat?: (value: number) => string;
  height?: number;
  loading?: boolean;
  emptyText?: string;
  footer?: ReactNode;
}

// Rounded only at the data end; the baseline stays square.
export function barPath(x: number, y: number, width: number, height: number, radius: number, roundTop: boolean): string {
  const r = Math.max(0, Math.min(radius, width / 2, height));
  if (height <= 0 || width <= 0) return "";
  if (!roundTop || r === 0) return `M${x} ${y}h${width}v${height}h${-width}Z`;
  return `M${x} ${y + height}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + width - r}Q${x + width} ${y} ${x + width} ${y + r}V${y + height}Z`;
}

export function BarChart({
  title,
  description,
  categories,
  series,
  stacked = false,
  yFormat = formatCompact,
  valueFormat = formatNumber,
  height = 240,
  loading = false,
  emptyText,
  footer,
}: BarChartProps) {
  const [wrapRef, width] = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<{ category: number; series: number } | null>(null);
  const visible = series.slice(0, 4);
  const allValues = visible.flatMap((line) => line.values.filter((v): v is number => v !== null && Number.isFinite(v)));
  const stackTotals = categories.map((_, index) =>
    visible.reduce((sum, line) => sum + Math.max(0, line.values[index] ?? 0), 0),
  );
  const empty = categories.length === 0 || allValues.length === 0;
  const plotWidth = Math.max(40, width - MARGIN.left - MARGIN.right);
  const plotHeight = Math.max(40, height - MARGIN.top - MARGIN.bottom);
  const domain = niceDomain(stacked ? [...stackTotals, 0] : [...allValues, 0], { includeZero: true, count: 4 });
  const yScale = linearScale(domain, [MARGIN.top + plotHeight, MARGIN.top]);
  const yTicks = niceTicks(domain[0], domain[1], 4);
  const band = categories.length ? plotWidth / categories.length : plotWidth;
  const innerWidth = band * 0.7;
  const labelEvery = band < 44 ? Math.ceil(44 / band) : 1;
  // The tallest category gets a direct value label; every other value lives in the tooltip and table.
  const categoryTotals = stacked
    ? stackTotals
    : categories.map((_, index) => Math.max(0, ...visible.map((line) => line.values[index] ?? 0)));
  const tallest = categoryTotals.indexOf(Math.max(...categoryTotals));

  const table = (
    <ChartDataTable
      caption={`${title}, values by category`}
      columns={["Category", ...visible.map((line) => line.label)]}
      rows={categories.map((category, index) => [
        category,
        ...visible.map((line) => {
          const value = line.values[index];
          return value === null || value === undefined || !Number.isFinite(value) ? null : valueFormat(value);
        }),
      ])}
    />
  );

  function bars() {
    const nodes: ReactNode[] = [];
    categories.forEach((category, categoryIndex) => {
      const bandStart = MARGIN.left + categoryIndex * band;
      if (stacked) {
        const x = bandStart + (band - Math.min(MAX_BAR, innerWidth)) / 2;
        const w = Math.min(MAX_BAR, innerWidth);
        const values = visible.map((line) => Math.max(0, line.values[categoryIndex] ?? 0));
        const offsets = stackOffsets(values);
        const topIndex = values.map((v, i) => (v > 0 ? i : -1)).filter((i) => i >= 0).pop();
        visible.forEach((line, seriesIndex) => {
          const value = line.values[categoryIndex];
          if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) return;
          const top = yScale(offsets[seriesIndex].end);
          const bottom = yScale(offsets[seriesIndex].start);
          nodes.push(
            <BarMark key={`${category}-${line.id}`} path={barPath(x + GAP / 2, top + GAP / 2, w - GAP, bottom - top - GAP, RADIUS, seriesIndex === topIndex)}
              color={slotColor(seriesIndex)} label={`${category}, ${line.label}: ${valueFormat(value)}`}
              active={active?.category === categoryIndex} onEnter={() => setActive({ category: categoryIndex, series: seriesIndex })} onLeave={() => setActive(null)}
              dimmed={active !== null && active.category !== categoryIndex} />,
          );
        });
        return;
      }
      const count = Math.max(1, visible.length);
      const each = Math.min(MAX_BAR, (innerWidth - (count - 1) * GAP) / count);
      const groupWidth = each * count + (count - 1) * GAP;
      visible.forEach((line, seriesIndex) => {
        const value = line.values[categoryIndex];
        if (value === null || value === undefined || !Number.isFinite(value)) return;
        const x = bandStart + (band - groupWidth) / 2 + seriesIndex * (each + GAP);
        const top = yScale(Math.max(0, value));
        const bottom = yScale(Math.min(0, value));
        const h = Math.abs(bottom - top);
        nodes.push(
          <BarMark key={`${category}-${line.id}`} path={barPath(x, Math.min(top, bottom), each, h, RADIUS, value > 0)}
            color={slotColor(seriesIndex)} label={`${category}, ${line.label}: ${valueFormat(value)}`}
            active={active?.category === categoryIndex && active.series === seriesIndex}
            onEnter={() => setActive({ category: categoryIndex, series: seriesIndex })} onLeave={() => setActive(null)}
            dimmed={active !== null && !(active.category === categoryIndex && active.series === seriesIndex)} />,
        );
      });
    });
    return nodes;
  }

  const activeCategory = active ? categories[active.category] : null;
  const tooltipX = active ? MARGIN.left + active.category * band + band / 2 : 0;
  return (
    <ChartFrame title={title} description={description} loading={loading} empty={empty} emptyText={emptyText ?? "No values in this period."} table={table} footer={footer}>
      <div className="bar-chart" ref={wrapRef}>
        {visible.length >= 2 && (
          <ul className="chart-legend" aria-label="Legend">
            {visible.map((line, index) => (
              <li key={line.id}>
                <span className="chart-key-swatch" style={{ background: slotColor(index) }} aria-hidden="true" />
                {line.label}
              </li>
            ))}
          </ul>
        )}
        <div className="chart-plot-focus">
          <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="presentation" focusable="false" onPointerLeave={() => setActive(null)}>
            {yTicks.map((tick) => (
              <g key={`y-${tick}`}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={yScale(tick)} y2={yScale(tick)} stroke="var(--chart-grid)" strokeWidth={1} />
                <text className="chart-axis-text" x={MARGIN.left - 8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle">{yFormat(tick)}</text>
              </g>
            ))}
            <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={yScale(0)} y2={yScale(0)} stroke="var(--chart-axis)" strokeWidth={1} />
            {categories.map((category, index) =>
              index % labelEvery === 0 ? (
                <text key={`x-${category}-${index}`} className="chart-axis-text" x={MARGIN.left + index * band + band / 2} y={height - 8} textAnchor="middle">{category}</text>
              ) : null,
            )}
            {bars()}
            {!empty && tallest >= 0 && categoryTotals[tallest] > 0 && !active && (
              <text className="chart-value-label" x={MARGIN.left + tallest * band + band / 2} y={yScale(categoryTotals[tallest]) - 6} textAnchor="middle">
                {valueFormat(categoryTotals[tallest])}
              </text>
            )}
          </svg>
          {active && activeCategory !== null && (
            <div className="chart-tooltip" style={{ left: tooltipX, top: MARGIN.top }} aria-hidden="true">
              <strong className="chart-tooltip-title">{activeCategory}</strong>
              {visible.map((line, index) => {
                const value = line.values[active.category];
                return (
                  <span key={line.id} className={`chart-tooltip-row${index === active.series ? " is-current" : ""}`}>
                    <span className="chart-key-swatch" style={{ background: slotColor(index) }} />
                    <span className="chart-tooltip-value">{value === null || value === undefined ? "No data" : valueFormat(value)}</span>
                    <span>{line.label}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </ChartFrame>
  );
}

// A bar is its own hit target: focusable, labeled, and dimmed siblings when one is active.
function BarMark({ path, color, label, active, dimmed, onEnter, onLeave }: {
  path: string; color: string; label: string; active: boolean; dimmed: boolean; onEnter: () => void; onLeave: () => void;
}) {
  return (
    <path
      d={path}
      fill={color}
      className={`chart-mark${active ? " is-active" : ""}${dimmed ? " is-dimmed" : ""}`}
      tabIndex={0}
      role="img"
      aria-label={label}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
      onFocus={onEnter}
      onBlur={onLeave}
    />
  );
}
