import Link from "next/link";

import { cn } from "@/lib/utils";
import { tabHref } from "@/lib/tabs";

export function Card({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-surface p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h2 className="font-display text-lg font-semibold tracking-tight">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-sm text-text-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="border-b border-line px-5 py-8 md:px-10">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-2xl font-semibold tracking-tight md:text-3xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm text-text-muted">{subtitle}</p>
        )}
      </div>
    </header>
  );
}

/**
 * Pure URL builder for a tab link — see lib/tabs.ts for the shared definition.
 */
export { tabHref } from "@/lib/tabs";

/**
 * Server-rendered tab navigation — works without client JavaScript.
 *
 * Tabs are links that carry the chosen tab id in a query parameter, so the
 * server renders the selected panel. `params` preserves any other query state
 * (notices, wizard fields) across tab switches.
 */
export function Tabs({
  tabs,
  current,
  tabKey = "tab",
  params = {},
  basePath,
}: {
  tabs: Array<{ id: string; label: string; badge?: number }>;
  current: string;
  tabKey?: string;
  params?: Record<string, string | undefined>;
  basePath: string;
}) {
  const hrefFor = (id: string) => tabHref(basePath, tabKey, params, id);
  return (
    <div role="tablist" aria-label="Sections" className="flex flex-wrap gap-1 border-b border-line">
      {tabs.map((t) => {
        const active = t.id === current;
        return (
          <Link
            key={t.id}
            href={hrefFor(t.id)}
            role="tab"
            aria-selected={active}
            className={cn(
              "-mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm transition-colors",
              active
                ? "border-accent font-medium text-accent"
                : "border-transparent text-text-muted hover:border-line hover:text-text"
            )}
          >
            {t.label}
            {typeof t.badge === "number" && t.badge > 0 && (
              <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[10px] text-text-faint">
                {t.badge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

const badgeStyles: Record<string, string> = {
  neutral: "border-line bg-surface-2 text-text-muted",
  accent: "border-transparent bg-accent-soft text-accent",
  success: "border-transparent bg-success/10 text-success",
  warning: "border-transparent bg-warning/10 text-warning",
  danger: "border-transparent bg-danger/10 text-danger",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: keyof typeof badgeStyles;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        badgeStyles[tone]
      )}
    >
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="font-mono text-xs uppercase tracking-wider text-text-faint">
        {label}
      </span>
      <span className="font-display text-2xl font-semibold tracking-tight">
        {value}
      </span>
      {hint && <span className="text-xs text-text-faint">{hint}</span>}
    </Card>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-line bg-surface px-6 py-14 text-center">
      <p className="font-display font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-text-muted">{description}</p>
      {action}
    </div>
  );
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-background transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-transparent px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Native <select> dropdown with its label — works without client JS.
 *  `hint` adds one line of plain-language help under the label so users
 *  never have to guess what a field wants. `options` may be plain strings
 *  (value = label) or {value, label} pairs. */
export function DropdownField({
  label,
  name,
  options,
  defaultValue,
  required = false,
  hint,
}: {
  label: string;
  name: string;
  options: readonly (string | { value: string; label: string })[];
  defaultValue?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-text-faint">
      {label}
      <select
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="h-10 w-full rounded-lg border border-line bg-surface-2 px-3 text-sm text-text"
      >
        {options.map((o) =>
          typeof o === "string" ? (
            <option key={o} value={o}>
              {o}
            </option>
          ) : (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          )
        )}
      </select>
      {hint && <span className="text-[11px] leading-relaxed text-text-faint">{hint}</span>}
    </label>
  );
}

/**
 * Server-rendered suggestion field for free text: an <input> wired to a
 * native <datalist> so the browser offers one-click suggestions while still
 * accepting anything the user types. Works without client JS — the datalist
 * is static markup. (<textarea> has no native datalist support, so multi-line
 * fields fall back to a plain textarea with a strong placeholder.)
 */
export function SuggestField({
  label,
  name,
  suggestions,
  placeholder,
  hint,
  textarea = false,
  rows = 3,
  required = false,
  defaultValue,
}: {
  label: string;
  name: string;
  suggestions: readonly string[];
  placeholder?: string;
  hint?: string;
  textarea?: boolean;
  rows?: number;
  required?: boolean;
  defaultValue?: string;
}) {
  const listId = `suggestions-${name.replace(/[^a-z0-9-]/gi, "-")}`;
  const common =
    "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text placeholder:text-text-faint";
  return (
    <label className="flex flex-col gap-1 text-xs text-text-faint">
      {label}
      {textarea ? (
        <textarea
          name={name}
          rows={rows}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          className={cn(common, "resize-y font-mono text-[13px] leading-relaxed")}
        />
      ) : (
        <input
          name={name}
          required={required}
          defaultValue={defaultValue}
          placeholder={placeholder}
          list={listId}
          className={common}
        />
      )}
      {textarea ? null : (
        <datalist id={listId}>
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      )}
      {hint && <span className="text-[11px] leading-relaxed text-text-faint">{hint}</span>}
    </label>
  );
}
