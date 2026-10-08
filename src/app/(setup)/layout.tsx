import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// Reads the session cookie — must render per-request.
export const instant = false;

/**
 * Setup shell: onboarding requires a signed-in user, but NOT completed
 * onboarding (that would cause an infinite redirect loop — the protected
 * (app) group bounces unfinished users here, so this group must let
 * them through).
 */
export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return children;
}
