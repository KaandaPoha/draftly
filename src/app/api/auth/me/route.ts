import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connection } from "next/server";

// Opt out of build-time prerendering: this route reads the session cookie,
// which is only available at request time.
export async function GET() {
  await connection();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ user: null });

  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      onboardingDone: Boolean(user.preference),
    },
  });
}
