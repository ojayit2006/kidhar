import crypto from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "kidhar_admin";

function expectedToken() {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return null;
  return crypto.createHmac("sha256", pw).update("kidhar-admin-v1").digest("hex");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const adminEnabled = () => Boolean(process.env.ADMIN_PASSWORD);

export function checkPassword(input: string) {
  const pw = process.env.ADMIN_PASSWORD;
  return Boolean(pw) && safeEqual(input, pw!);
}

export const sessionToken = expectedToken;

export async function isAdmin() {
  const t = expectedToken();
  if (!t) return false;
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(c) && safeEqual(c!, t);
}
