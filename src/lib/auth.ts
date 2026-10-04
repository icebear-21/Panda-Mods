import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb, type User } from "./db";

const COOKIE_NAME = "panda_session";
const SESSION_LENGTH = 60 * 60 * 24 * 14;

export function verifyPassword(password: string, encoded: string) {
  const [salt, expectedHex] = encoded.split(":");
  if (!salt || !expectedHex || expectedHex.length !== 128) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(expectedHex, "hex"));
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function currentUser(): Promise<User | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const user = getDb().prepare(`
    SELECT users.id, users.email, users.display_name, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ?
  `).get(tokenHash(token), Date.now()) as User | undefined;
  return user ?? null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const db = getDb();
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)")
    .run(tokenHash(token), userId, Date.now() + SESSION_LENGTH * 1000);
  (await cookies()).set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LENGTH,
  });
}

export async function destroySession() {
  const cookieJar = await cookies();
  const token = cookieJar.get(COOKIE_NAME)?.value;
  if (token) getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  cookieJar.delete(COOKIE_NAME);
}
