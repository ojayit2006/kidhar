import crypto from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "kidhar_admin";
export const STAFF_COOKIE = "kidhar_staff";

function hmac(secret: string, label: string) {
  return crypto.createHmac("sha256", secret).update(label).digest("hex");
}

function expectedToken() {
  const pw = process.env.ADMIN_PASSWORD;
  return pw ? hmac(pw, "kidhar-admin-v1") : null;
}

function staffToken() {
  const pw = process.env.STAFF_PASSWORD;
  return pw ? hmac(pw, "kidhar-staff-v1") : null;
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export const adminEnabled = () => Boolean(process.env.ADMIN_PASSWORD);
export const staffEnabled = () => Boolean(process.env.STAFF_PASSWORD);

export function checkPassword(input: string) {
  const pw = process.env.ADMIN_PASSWORD;
  return Boolean(pw) && safeEqual(input, pw!);
}

export function checkStaffPassword(input: string) {
  const pw = process.env.STAFF_PASSWORD;
  return Boolean(pw) && safeEqual(input, pw!);
}

export const sessionToken = expectedToken;
export const staffSessionToken = staffToken;

export async function isAdmin() {
  const t = expectedToken();
  if (!t) return false;
  const c = (await cookies()).get(ADMIN_COOKIE)?.value;
  return Boolean(c) && safeEqual(c!, t);
}

export type StaffAccess = "ok" | "login" | "disabled";

/**
 * Who may read the incident queue (caller messages and GPS are sensitive).
 * - admin session: ok
 * - STAFF_PASSWORD set: needs the staff cookie
 * - STAFF_PASSWORD unset: open in local development, closed in production
 */
export async function staffAccess(): Promise<StaffAccess> {
  if (await isAdmin()) return "ok";
  if (!staffEnabled()) return process.env.NODE_ENV === "production" ? "disabled" : "ok";
  const t = staffToken();
  const c = (await cookies()).get(STAFF_COOKIE)?.value;
  return t && c && safeEqual(c, t) ? "ok" : "login";
}

/** Returns an error Response when the caller is not staff, otherwise null. */
export async function staffGuard(): Promise<Response | null> {
  const a = await staffAccess();
  if (a === "ok") return null;
  if (a === "disabled") return Response.json({ error: "Staff access is disabled. Set STAFF_PASSWORD on the server." }, { status: 503 });
  return Response.json({ error: "Staff login required." }, { status: 401 });
}
