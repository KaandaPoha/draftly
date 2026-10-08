import Link from "next/link";

/**
 * Server-rendered theme switcher. Plain links to /api/theme — works with
 * JavaScript disabled (the user's browser often fails to hydrate).
 * `current` is read from the cookie by the server.
 */
export function ThemeLinks({ current }: { current: "dark" | "light" }) {
  const options: Array<{ value: "dark" | "light"; label: string }> = [
    { value: "dark", label: "Dark (default)" },
    { value: "light", label: "Light" },
  ];

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
      {options.map(({ value, label }) =>
        value === current ? (
          <span
            key={value}
            aria-current="true"
            className="inline-flex h-10 items-center rounded-lg border border-accent bg-accent-soft px-4 text-sm font-medium text-accent"
          >
            {label} ✓
          </span>
        ) : (
          <Link
            key={value}
            href={`/api/theme?set=${value}&next=/settings`}
            className="inline-flex h-10 items-center rounded-lg border border-line bg-surface-2 px-4 text-sm font-medium text-text transition-colors hover:bg-surface-2 hover:text-accent"
          >
            {label}
          </Link>
        )
      )}
    </div>
  );
}
