"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { testConnection } from "@/lib/llm";

/**
 * Runs a real, tiny request against the configured provider and reloads the
 * settings page with the outcome. Only ever triggered by the explicit
 * "Test connection" button — never on page load.
 */
export async function testProvider() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const result = await testConnection();
  const param = result.ok
    ? `tested=ok&detail=${encodeURIComponent(result.model)}`
    : `tested=fail&detail=${encodeURIComponent(result.error)}`;

  redirect(`/settings?test=1&${param}`);
}