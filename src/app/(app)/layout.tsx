import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

// Reads the session cookie, so every page below must render per-request.
export const instant = false;

/**
 * Protected shell: every page inside (app) requires a signed-in user.
 * Signed-out visitors are redirected to /login; users who haven't
 * finished onboarding are sent to /onboarding.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) redirect("/login");
  if (!user.preference) redirect("/onboarding");

  return (
    <AppShell userName={user.name}>{children}</AppShell>
  );
}
