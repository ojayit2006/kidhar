import { cookies } from "next/headers";
import { ADMIN_COOKIE, adminEnabled, checkPassword, sessionToken } from "@/lib/adminAuth";
import { rateLimit } from "@/lib/ratelimit";

export async function POST(req: Request) {
  if (!adminEnabled()) return Response.json({ error: "Admin is disabled. Set ADMIN_PASSWORD on the server." }, { status: 503 });

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const rl = rateLimit(`admin:${ip}`, 5, 60_000);
  if (!rl.ok) return Response.json({ error: `Too many attempts. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });

  const { password } = (await req.json()) as { password?: string };
  if (!password || !checkPassword(password)) return Response.json({ error: "Wrong password." }, { status: 401 });

  (await cookies()).set(ADMIN_COOKIE, sessionToken()!, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
  return Response.json({ ok: true });
}
