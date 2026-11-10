import { Panel } from "@/components/ui";
import type { DataRow } from "@/lib/organization-api";

// Scrollable record table used across the organization screens. Missing cells say so instead of showing blanks.
export function DataTable({ title, rows, columns, description }: { title: string; rows: DataRow[]; columns: [string, string][]; description?: string }) {
  return (
    <Panel className="org-data-table">
      <h3>{title}</h3>
      {description && <p className="org-muted">{description}</p>}
      {!rows.length ? (
        <p className="org-empty">No authorized records to display.</p>
      ) : (
        <div className="org-table-scroll">
          <table aria-label={title}>
            <thead>
              <tr>
                {columns.map(([key, label]) => (
                  <th key={key} scope="col">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={String(row.id ?? index)}>
                  {columns.map(([key]) => {
                    const value = row[key];
                    const missing = value === null || value === undefined;
                    return (
                      <td key={key} className={typeof value === "number" ? "is-numeric" : undefined}>
                        {missing ? <span className="org-muted">Not recorded</span> : String(value)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
