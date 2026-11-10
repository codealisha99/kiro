import type { HTMLAttributes, ReactNode } from "react";
import "./page.css";

function classes(...values: (string | undefined | false)[]) {
  return values.filter(Boolean).join(" ");
}

// Shared page heading for every workspace screen: title, meta line, actions, and optional tabs.
export function PageHeader({
  title,
  subtitle,
  meta,
  actions,
  tabs,
  eyebrow,
  id = "page-title",
}: {
  title: string;
  subtitle?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  eyebrow?: string;
  id?: string;
}) {
  return (
    <header className="ui-page-header">
      <div className="ui-page-heading">
        <div className="ui-page-title-row">
          <div className="ui-page-title-block">
            {eyebrow && <p className="ui-page-eyebrow">{eyebrow}</p>}
            <h1 id={id}>{title}</h1>
            {subtitle && <p className="ui-page-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="ui-page-actions">{actions}</div>}
        </div>
        {meta && <div className="ui-page-meta">{meta}</div>}
      </div>
      {tabs && <div className="ui-page-tabs">{tabs}</div>}
    </header>
  );
}

// Arrow-key tabs with roving focus. Each item renders as a tab and sets the selected value.
export function PageTabs<T extends string>({
  items,
  value,
  onChange,
  label,
}: {
  items: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  label: string;
}) {
  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    const index = items.findIndex((item) => item.id === value);
    const next = items[(index + (event.key === "ArrowRight" ? 1 : items.length - 1)) % items.length];
    event.preventDefault();
    onChange(next.id);
    requestAnimationFrame(() => {
      const tab = document.getElementById(`tab-${next.id}`);
      tab?.focus();
      tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }
  return (
    <div role="tablist" aria-label={label} className="ui-page-tablist" onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            id={`tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={classes("ui-page-tab", selected && "is-selected")}
            onClick={(event) => {
              onChange(item.id);
              event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
            }}
          >
            {item.label}
            {item.count !== undefined && <span className="ui-page-tab-count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

// A titled group of related content. Use it for every block inside a page.
export function Section({
  title,
  description,
  actions,
  id,
  children,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  id?: string;
  children: ReactNode;
  className?: string;
}) {
  const headingId = `${id ?? title.replace(/\W+/g, "-").toLowerCase()}-heading`;
  return (
    <section className={classes("ui-section", className)} aria-labelledby={headingId}>
      <div className="ui-section-head">
        <div>
          <h2 id={headingId}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        {actions && <div className="ui-section-actions">{actions}</div>}
      </div>
      <div className="ui-section-body">{children}</div>
    </section>
  );
}

// A bordered surface for grouping data. `tone="raised"` sits one step lighter for emphasis.
export function Panel({
  tone = "panel",
  padded = true,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: "panel" | "raised"; padded?: boolean }) {
  return (
    <div
      className={classes("ui-panel", `tone-${tone}`, padded && "is-padded", className)}
      {...props}
    />
  );
}
