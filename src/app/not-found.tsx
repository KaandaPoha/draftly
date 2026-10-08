import Link from "next/link";

// The root layout reads the theme cookie per-request; keep the 404 page
// blocking rather than streaming a shell.
export const instant = false;

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-sm font-medium uppercase tracking-widest text-text-faint">
        404
      </p>
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="max-w-sm text-sm leading-relaxed text-text-muted">
        The page you were looking for doesn&apos;t exist or may have been moved.
      </p>
      <Link
        href="/"
        className="inline-flex h-10 items-center rounded-lg bg-accent px-5 text-sm font-medium text-background transition-opacity hover:opacity-90"
      >
        Go to Draftly
      </Link>
    </div>
  );
}
