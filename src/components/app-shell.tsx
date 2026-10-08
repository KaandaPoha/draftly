import Link from "next/link";
import {
  LayoutDashboard,
  Sparkles,
  Image as ImageIcon,
  MessageSquare,
  CalendarRange,
  FolderOpen,
  Users,
  Settings as SettingsIcon,
  PenLine,
  LogOut,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Content", icon: Sparkles },
  { href: "/create/image", label: "Create from Image", icon: ImageIcon },
  { href: "/assistant", label: "AI Assistant", icon: MessageSquare },
  { href: "/planner", label: "Content Planner", icon: CalendarRange },
  { href: "/campaigns", label: "Campaigns", icon: FolderOpen },
  { href: "/profiles", label: "Brand Profiles", icon: Users },
  { href: "/drafts", label: "Drafts", icon: PenLine },
  { href: "/compare", label: "Compare", icon: MessageSquare },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

function NavLinks({ pathname }: { pathname: string }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              active
                ? "bg-accent-soft text-accent font-medium"
                : "text-text-muted hover:bg-surface-2 hover:text-text"
            )}
          >
            <Icon size={17} strokeWidth={1.8} aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-5 py-6">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-background">
        <PenLine size={17} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="font-display text-lg font-semibold tracking-tight">
        Draftly
      </span>
    </Link>
  );
}

function SignOutForm() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
      >
        <LogOut size={15} aria-hidden /> Sign out
      </button>
    </form>
  );
}

/**
 * Fully server-rendered shell — zero client JavaScript.
 * The mobile menu uses <details>, which opens/closes natively in every
 * browser without JS. Sign out is a server-action form.
 */
export async function AppShell({
  children,
  pathname,
}: {
  children: React.ReactNode;
  pathname: string;
}) {
  const user = await getCurrentUser();
  const userName = user?.name ?? null;

  return (
    <div className="flex min-h-dvh">
      {/* Skip link */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface md:flex">
        <Logo />
        <NavLinks pathname={pathname} />
        <div className="mt-auto flex flex-col gap-2 px-5 pb-5 pt-4">
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-text-faint">
            Signed in as{" "}
            <span className="font-medium text-text-muted">{userName ?? "your account"}</span>
          </p>
          <SignOutForm />
        </div>
      </aside>

      {/* Mobile top bar with native <details> menu */}
      <details className="fixed inset-x-0 top-0 z-40 md:hidden">
        <summary className="flex list-none items-center justify-between border-b border-line bg-surface px-4 py-3 [&::-webkit-details-marker]:hidden">
          <Logo />
          <span
            aria-hidden
            className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18M3 12h18M3 18h18" />
            </svg>
          </span>
        </summary>
        <div className="border-b border-line bg-surface pb-4 pt-2">
          <NavLinks pathname={pathname} />
          <div className="flex flex-col gap-2 px-5 pb-2 pt-4">
            <SignOutForm />
          </div>
        </div>
      </details>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col pt-[61px] md:pt-0">
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
