import fs from "node:fs";
import path from "node:path";
import { isAdmin } from "@/lib/adminAuth";

const FILES = { replay: "replay.json", geocache: "geocache.json" } as const;

/** Clear a cache. Replay cache = saved demo runs for offline mode; geocache = saved map lookups. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { target } = (await req.json()) as { target?: keyof typeof FILES };
  if (!target || !(target in FILES)) return Response.json({ error: "Bad target" }, { status: 400 });
  try {
    fs.writeFileSync(path.join(process.cwd(), "data", FILES[target]), "{}");
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ error: `Could not clear (read-only filesystem?): ${err.message}` }, { status: 500 });
  }
}
