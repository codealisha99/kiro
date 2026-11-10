"use client";

import { useId, useState, type ReactNode } from "react";

export type TableCell = string | number | null;

// The accessible twin of a chart. Every chart is reachable through this table.
export function ChartDataTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: TableCell[][] }) {
  return (
    <div className="chart-table-scroll">
      <table className="chart-table">
        <caption className="chart-sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column, index) => (
              <th key={`${column}-${index}`} scope="col" className={index === 0 ? undefined : "num"}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) =>
                cellIndex === 0 ? (
                  <th key={cellIndex} scope="row">
                    {cell ?? "No data"}
                  </th>
                ) : (
                  <td key={cellIndex} className="num">
                    {cell ?? "No data"}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ChartFrame({
  title,
  description,
  table,
  loading = false,
  empty = false,
  emptyText = "No data for this period.",
  footer,
  children,
  className,
}: {
  title: string;
  description?: string;
  table?: ReactNode;
  loading?: boolean;
  empty?: boolean;
  emptyText?: string;
  footer?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [showTable, setShowTable] = useState(false);
  const canToggle = !!table && !loading && !empty;
  const tableMode = canToggle && showTable;
  let body: ReactNode = children;
  if (loading) body = <div className="chart-state" role="status">Loading…</div>;
  else if (empty) body = <div className="chart-state">{emptyText}</div>;
  else if (tableMode) body = table;
  return (
    <figure
      className={["chart", className].filter(Boolean).join(" ")}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={loading || undefined}
    >
      <figcaption className="chart-head">
        <div className="chart-heading">
          <h3 id={titleId}>{title}</h3>
          {description && <p id={descriptionId}>{description}</p>}
        </div>
        {canToggle && (
          <button
            type="button"
            className="chart-table-toggle"
            aria-pressed={showTable}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? "View as chart" : "View as table"}
          </button>
        )}
      </figcaption>
      <div className="chart-body">{body}</div>
      {footer && !loading && <div className="chart-foot">{footer}</div>}
    </figure>
  );
}
