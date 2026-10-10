import fs from "node:fs";
import path from "node:path";
import { MUMBAI_BBOX, type LatLon } from "./geo";

export type Candidate = { name: string; lat: number; lon: number; type: string };

const CACHE_FILE = path.join(process.cwd(), "data", "geocache.json");
let cache: Record<string, Candidate[]> | null = null;
let lastCall = 0;

function load() {
  if (cache) return cache;
  try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, "utf8")); } catch { cache = {}; }
  return cache!;
}

export async function geocode(query: string): Promise<{ candidates: Candidate[]; cached: boolean }> {
  const key = query.trim().toLowerCase();
  const c = load();
  if (c[key]) return { candidates: c[key], cached: true };

  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastCall = Date.now();

  const { west, north, east, south } = MUMBAI_BBOX;
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&bounded=1&viewbox=${west},${north},${east},${south}&q=${encodeURIComponent(query + " Mumbai")}`;
  const res = await fetch(url, { headers: { "User-Agent": "kidhar-hackathon/0.1 (build-day prototype)" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const rows = (await res.json()) as any[];
  const candidates: Candidate[] = rows.map((r) => ({
    name: String(r.display_name).split(",").slice(0, 3).join(","),
    lat: +(+r.lat).toFixed(5),
    lon: +(+r.lon).toFixed(5),
    type: `${r.category}/${r.type}`,
  }));
  c[key] = candidates;
  try { fs.writeFileSync(CACHE_FILE, JSON.stringify(c, null, 1)); } catch {}
  return { candidates, cached: false };
}

export function matchesAnyCandidate(p: LatLon, all: Candidate[]) {
  return all.some((c) => Math.abs(c.lat - p.lat) < 1e-4 && Math.abs(c.lon - p.lon) < 1e-4);
}
