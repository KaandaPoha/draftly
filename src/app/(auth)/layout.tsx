import { PenLine } from "lucide-react";

// The root layout reads the theme cookie per-request; keep auth pages
// blocking rather than streaming a shell.
export const instant = false;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-background">
            <PenLine size={17} strokeWidth={2.2} aria-hidden />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Draftly
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
