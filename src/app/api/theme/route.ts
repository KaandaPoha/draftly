import { NextResponse } from "next/server";

/**
 * No-JS theme switcher: a plain link hits this route with ?set=light|dark
 * and ?next=/settings (where to go back to). The route sets a long-lived
 * cookie and redirects back — no client JavaScript involved.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const theme = searchParams.get("set") === "light" ? "light" : "dark";
  const next = searchParams.get("next") ?? "/settings";

  // Only allow relative paths inside the app to avoid open redirects.
  const target = next.startsWith("/") ? next : "/settings";

  // Build the redirect from the Host header the browser actually used,
  // so a user on http://127.0.0.1:3000 is sent back to 127.0.0.1, not
  // to a hostname their machine may not resolve.
  const host = request.headers.get("host") ?? new URL(request.url).host;
  const response = NextResponse.redirect(
    new URL(target, `http://${host}`),
    303
  );
  response.cookies.set("draftly-theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
    httpOnly: false, // harmless if read by scripts; theme is not sensitive
  });
  return response;
}
