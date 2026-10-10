import { cookies } from "next/headers";
import { STAFF_COOKIE, checkStaffPassword, staffEnabled, staffSessionToken } from "@/lib/adminAuth";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!staffEnabled()) return Response.json({ error: "Staff login is not configured (STAFF_PASSWORD)." }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`staff:${ip}`, 5, 60_000);
  if (!rl.ok) return Response.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });

  const { password } = (await req.json()) as { password?: string };
  if (!password || !checkStaffPassword(password)) return Response.json({ error: "Wrong password." }, { status: 401 });

  (await cookies()).set(STAFF_COOKIE, staffSessionToken()!, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return Response.json({ ok: true });
}
