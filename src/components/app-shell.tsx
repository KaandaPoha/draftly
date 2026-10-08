"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Sparkles,
  MessageSquare,
  CalendarRange,
  FolderOpen,
  Users,
  Settings,
  Menu,
  X,
  PenLine,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Create Content", icon: Sparkles },
  { href: "/assistant", label: "AI Assistant", icon: MessageSquare },
  { href: "/planner", label: "Content Planner", icon: CalendarRange },
  { href: "/campaigns", label: "Campaigns", icon: FolderOpen },
  { href: "/profiles", label: "Brand Profiles", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex flex-col gap-1 px-3">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
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

export function AppShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh">
      {/* Skip link for keyboard users */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-background"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:flex md:flex-col">
        <Logo />
        <NavLinks />
        <div className="mt-auto flex flex-col gap-2 px-5 pb-5 pt-4">
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-xs leading-relaxed text-text-faint">
            Signed in as{" "}
            <span className="font-medium text-text-muted">
              {userName ?? "your account"}
            </span>
          </p>
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-text-muted transition-colors hover:bg-surface-2 hover:text-text"
          >
            <LogOut size={15} aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Logo />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-text-muted hover:bg-surface-2 hover:text-text"
        >
          {open ? <X size={20} aria-hidden /> : <Menu size={20} aria-hidden />}
        </button>
      </div>
      {open && (
        <div className="fixed inset-x-0 top-[61px] z-30 border-b border-line bg-surface pb-4 pt-2 md:hidden">
          <NavLinks onNavigate={() => setOpen(false)} />
        </div>
      )}

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col pt-[61px] md:pt-0">
        <main id="main" className="flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
