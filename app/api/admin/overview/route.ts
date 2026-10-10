import fs from "node:fs";
import path from "node:path";
import { adminEnabled, isAdmin } from "@/lib/adminAuth";
import { listIncidents, storeBackend } from "@/lib/store";

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", file), "utf8"));
  } catch {
    return fallback;
  }
}

export async function GET() {
  if (!adminEnabled()) return Response.json({ error: "disabled" }, { status: 503 });
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });

  let incidents: Awaited<ReturnType<typeof listIncidents>> = [];
  let storeOk = true;
  let storeError = "";
  try {
    incidents = await listIncidents();
  } catch (err: any) {
    storeOk = false;
    storeError = err.message;
  }

  const units = readJson<{ type: string }[]>("units.json", []);
  const count = (type: string) => units.filter((u) => u.type === type).length;
  const withResult = incidents.filter((i) => i.result);
  const etas = withResult.map((i) => Math.min(...(i.units.length ? i.units.map((u: { eta_min: number }) => u.eta_min) : [0])));

  const by = <T extends string>(key: (i: (typeof incidents)[number]) => T) =>
    incidents.reduce<Record<string, number>>((acc, i) => {
      const k = key(i);
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {});

  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;

  return Response.json({
    stats: {
      total: incidents.length,
      last24h: incidents.filter((i) => i.createdAt >= dayAgo).length,
      open: incidents.filter((i) => i.status !== "resolved").length,
      avgSeverity: withResult.length ? +(withResult.reduce((a, i) => a + i.result.severity, 0) / withResult.length).toFixed(1) : null,
      avgFastestEta: etas.length ? +(etas.reduce((a, b) => a + b, 0) / etas.length).toFixed(1) : null,
      lowConfidence: withResult.filter((i) => i.result.low_confidence).length,
      byStatus: by((i) => i.status),
      byType: by((i) => i.result?.incident_type ?? "unknown"),
      bySource: by((i) => i.source),
    },
    health: {
      storeBackend,
      storeOk,
      storeError,
      anthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
      units: { fire: count("fire"), police: count("police"), hospital: count("hospital") },
      replayEntries: Object.keys(readJson<Record<string, unknown>>("replay.json", {})).length,
      geocacheEntries: Object.keys(readJson<Record<string, unknown>>("geocache.json", {})).length,
      limits: { maxMessageChars: 600, callsPerMinute: 10 },
    },
    incidents: incidents.map((i) => ({
      id: i.id,
      createdAt: i.createdAt,
      status: i.status,
      source: i.source,
      message: i.message,
      type: i.result?.incident_type ?? null,
      severity: i.result?.severity ?? null,
      radius_m: i.result?.radius_m ?? null,
      lowConfidence: i.result?.low_confidence ?? false,
      units: i.assigned.length,
    })),
  });
}
