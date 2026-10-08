import { createHash, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { prisma } from "./prisma";

const scryptAsync = promisify(scrypt);

const SESSION_COOKIE = "draftly_session";
const SESSION_DAYS = 30;

/* ---------- password hashing (scrypt, built into Node — no extra deps) ---------- */

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string
): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const derived = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedBuf = Buffer.from(hash, "hex");
  return derived.length === storedBuf.length && timingSafeEqual(derived, storedBuf);
}

/* ---------- session management ---------- */

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Create a session row and set the cookie. Call after successful login/signup. */
export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: { token: hashToken(token), userId, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
  });
}

/** Get the signed-in user (or null). Safe to call anywhere on the server. */
export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: { include: { preference: true } } },
  });

  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
}

/** Delete the session row and clear the cookie. */
export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token: hashToken(token) } });
  }
  (await cookies()).delete(SESSION_COOKIE);
}
