"use client";

import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { ChartDataTable, ChartFrame } from "./ChartFrame";
import { formatDayLong, formatDayShort, slotColor } from "./chart-format";
import { useChartWidth } from "./use-chart-width";
import { formatCompact, formatNumber, linearScale, nearestIndex, niceDomain, niceTicks, timeTickIndexes } from "./scale";

export interface LinePoint {
  /** Epoch milliseconds (UTC). Points are plotted at their true time position. */
  x: number;
  /** Null leaves a gap in the line. */
  y: number | null;
}

export interface LineSeries {
  id: string;
  label: string;
  points: LinePoint[];
  /** Draw dashed, e.g. an ideal pace or forecast beside actuals. */
  dashed?: boolean;
}

const MARGIN = { top: 12, right: 64, bottom: 28, left: 48 };

export interface LineChartProps {
  title: string;
  description?: string;
  /** One to four series. Colors follow series order and never cycle past four. */
  series: LineSeries[];
  /** Optional horizontal reference line, such as a target. */
  target?: { label: string; value: number };
  yFormat?: (value: number) => string;
  valueFormat?: (value: number) => string;
  xFormat?: (epochMs: number) => string;
  height?: number;
  loading?: boolean;
  emptyText?: string;
  footer?: ReactNode;
}

export function LineChart({
  title,
  description,
  series,
  target,
  yFormat = formatCompact,
  valueFormat = formatNumber,
  xFormat = formatDayShort,
  height = 240,
  loading = false,
  emptyText,
  footer,
}: LineChartProps) {
  const [wrapRef, width] = useChartWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const visible = series.slice(0, 4);
  const xs = [...new Set(visible.flatMap((line) => line.points.map((point) => point.x)))].sort((a, b) => a - b);
  const values = visible.flatMap((line) => line.points.flatMap((point) => (point.y === null || !Number.isFinite(point.y) ? [] : [point.y])));
  const empty = xs.length === 0 || values.length === 0;
  const plotWidth = Math.max(40, width - MARGIN.left - MARGIN.right);
  const plotHeight = Math.max(40, height - MARGIN.top - MARGIN.bottom);

  const xDomain: [number, number] = xs.length === 1 ? [xs[0] - 86_400_000, xs[0] + 86_400_000] : [xs[0] ?? 0, xs[xs.length - 1] ?? 1];
  const yDomain = niceDomain(target ? [...values, target.value] : values, { count: 4 });
  const xScale = linearScale(xDomain, [MARGIN.left, MARGIN.left + plotWidth]);
  const yScale = linearScale(yDomain, [MARGIN.top + plotHeight, MARGIN.top]);
  const yTicks = niceTicks(yDomain[0], yDomain[1], 4);
  const xTickIndexSet = timeTickIndexes(xs, xScale, plotWidth < 320 ? 3 : 5);

  const activeIndex = active ?? null;
  const activeX = activeIndex === null ? null : xs[activeIndex];

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - bounds.left;
    const value = xScale.invert(px);
    setActive(nearestIndex(xs, value));
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (empty) return;
    if (event.key === "Escape") setActive(null);
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const current = activeIndex ?? xs.length - 1;
    const delta = event.key === "ArrowLeft" ? -1 : 1;
    setActive(Math.min(xs.length - 1, Math.max(0, current + delta)));
  }

  const table = (
    <ChartDataTable
      caption={`${title}, values by date`}
      columns={["Date", ...visible.map((line) => line.label), ...(target ? [target.label] : [])]}
      rows={xs.map((x) => [
        formatDayLong(x),
        ...visible.map((line) => {
          const point = line.points.find((item) => item.x === x);
          return point?.y === null || point?.y === undefined ? null : valueFormat(point.y);
        }),
        ...(target ? [valueFormat(target.value)] : []),
      ])}
    />
  );

  const tooltipLeft = activeX === null ? 0 : xScale(activeX);
  const flipTooltip = tooltipLeft > MARGIN.left + plotWidth * 0.6;
  const summary = visible.map((line) => line.label).join(", ");

  return (
    <ChartFrame
      title={title}
      description={description}
      loading={loading}
      empty={empty}
      emptyText={emptyText ?? "No values in this period."}
      table={table}
      footer={footer}
    >
      <div className="line-chart" ref={wrapRef}>
        {visible.length >= 2 && (
          <ul className="chart-legend" aria-label="Legend">
            {visible.map((line, index) => (
              <li key={line.id}>
                <span className="chart-key-line" style={keyStyle(index, line.dashed)} aria-hidden="true" />
                {line.label}
              </li>
            ))}
          </ul>
        )}
        <div
          className="chart-plot-focus"
          role="group"
          tabIndex={0}
          aria-label={`${title}. ${summary}. Use the left and right arrow keys to inspect values.`}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
        >
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            aria-hidden="true"
            focusable="false"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
          >
            {yTicks.map((tick) => (
              <g key={`y-${tick}`}>
                <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={yScale(tick)} y2={yScale(tick)} stroke="var(--chart-grid)" strokeWidth={1} />
                <text className="chart-axis-text" x={MARGIN.left - 8} y={yScale(tick)} textAnchor="end" dominantBaseline="middle">
                  {yFormat(tick)}
                </text>
              </g>
            ))}
            {xTickIndexSet.map((index) => (
              <text key={`x-${index}`} className="chart-axis-text" x={xScale(xs[index])} y={height - 8} textAnchor="middle">
                {xFormat(xs[index])}
              </text>
            ))}
            {target && (
              <g>
                <line x1={MARGIN.left} x2={MARGIN.left + plotWidth} y1={yScale(target.value)} y2={yScale(target.value)} stroke="var(--chart-target)" strokeWidth={1} />
                <text className="chart-axis-text" x={MARGIN.left + plotWidth} y={yScale(target.value) - 6} textAnchor="end">
                  {target.label} {valueFormat(target.value)}
                </text>
              </g>
            )}
            {visible.map((line, index) => {
              const segments = buildSegments(line.points, xScale, yScale);
              const last = [...line.points].reverse().find((point) => point.y !== null && Number.isFinite(point.y));
              return (
                <g key={line.id}>
                  {segments.map((segment, segmentIndex) => (
                    <path key={segmentIndex} d={segment} fill="none" stroke={slotColor(index)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={line.dashed ? "6 5" : undefined} />
                  ))}
                  {last && last.y !== null && (
                    <>
                      <circle cx={xScale(last.x)} cy={yScale(last.y)} r={4} fill={slotColor(index)} stroke="var(--chart-surface)" strokeWidth={2} />
                      <text className="chart-value-label" x={xScale(last.x) + 8} y={yScale(last.y)} dominantBaseline="middle">
                        {valueFormat(last.y)}
                      </text>
                    </>
                  )}
                  {activeX !== null &&
                    line.points
                      .filter((point) => point.x === activeX && point.y !== null && Number.isFinite(point.y))
                      .map((point) => (
                        <circle key={`${line.id}-active`} cx={xScale(point.x)} cy={yScale(point.y as number)} r={4} fill={slotColor(index)} stroke="var(--chart-surface)" strokeWidth={2} />
                      ))}
                </g>
              );
            })}
            {activeX !== null && (
              <line x1={xScale(activeX)} x2={xScale(activeX)} y1={MARGIN.top} y2={MARGIN.top + plotHeight} stroke="var(--chart-axis)" strokeWidth={1} />
            )}
            <rect x={MARGIN.left} y={MARGIN.top} width={plotWidth} height={plotHeight} fill="transparent" />
          </svg>
          {activeX !== null && (
            <div className={`chart-tooltip${flipTooltip ? " is-flipped" : ""}`} style={{ left: tooltipLeft, top: MARGIN.top }} aria-hidden="true">
              <strong className="chart-tooltip-title">{formatDayLong(activeX)}</strong>
              {visible.map((line, index) => {
                const point = line.points.find((item) => item.x === activeX);
                return (
                  <span key={line.id} className="chart-tooltip-row">
                    <span className="chart-key-line" style={keyStyle(index, line.dashed)} />
                    <span className="chart-tooltip-value">{point?.y === null || point === undefined ? "No data" : valueFormat(point.y)}</span>
                    <span>{line.label}</span>
                  </span>
                );
              })}
              {target && <span className="chart-tooltip-row"><span className="chart-key-line is-target" /><span className="chart-tooltip-value">{valueFormat(target.value)}</span><span>{target.label}</span></span>}
            </div>
          )}
        </div>
      </div>
    </ChartFrame>
  );
}

function keyStyle(index: number, dashed?: boolean) {
  const color = slotColor(index);
  return { background: dashed ? `repeating-linear-gradient(90deg, ${color} 0 5px, transparent 5px 8px)` : color };
}

// Splits a series at gaps so missing periods do not draw a false line.
function buildSegments(points: LinePoint[], x: (v: number) => number, y: (v: number) => number): string[] {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const segments: string[] = [];
  let current = "";
  for (const point of sorted) {
    if (point.y === null || !Number.isFinite(point.y)) {
      if (current) segments.push(current);
      current = "";
      continue;
    }
    const command = current ? "L" : "M";
    current += `${command}${x(point.x).toFixed(1)} ${y(point.y).toFixed(1)} `;
  }
  if (current) segments.push(current.trim());
  return segments;
}
