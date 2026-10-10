import fs from "node:fs";
import path from "node:path";
import { inMumbai, nearestUnits, type Unit } from "@/lib/geo";

const units: Unit[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "units.json"), "utf8"));

/** Public: nearest hospitals, police and fire stations to a point in Mumbai. No personal data involved. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat"));
  const lon = Number(u.searchParams.get("lon"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return Response.json({ error: "lat and lon are required." }, { status: 400 });
  if (!inMumbai({ lat, lon })) return Response.json({ error: "Nearby search covers Mumbai only." }, { status: 400 });
  return Response.json({ units: nearestUnits({ lat, lon }, units, 3) });
}
