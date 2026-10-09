import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { MarketingLanding } from "@/components/marketing";

// Reads the session cookie per-request.
export const instant = false;

/**
 * Root page, both audiences in one place:
 *  - signed-out visitors get the public marketing landing (previously a bare
 *    redirect that told them nothing about the product);
 *  - signed-in users get the dashboard, wrapped in the same AppShell the
 *    (app) layout uses so the sidebar chrome is identical;
 *  - signed-in but mid-onboarding users are sent to /onboarding.
 */
export default async function RootPage() {
  const user = await getCurrentUser();

  if (user && !user.preference) redirect("/onboarding");

  if (user) {
    const h = await headers();
    const pathname = h.get("x-invoke-path") ?? h.get("x-matched-path") ?? "/";
    const Dashboard = (await import("./(app)/page")).default;
    return (
      <AppShell pathname={pathname}>
        <Dashboard />
      </AppShell>
    );
  }

  return <MarketingLanding signedIn={false} />;
}
