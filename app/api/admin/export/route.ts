import { isAdmin } from "@/lib/adminAuth";
import { listIncidents } from "@/lib/store";

const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;

export async function GET() {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const rows = await listIncidents();
  const header = ["id", "created_at", "status", "source", "type", "severity", "radius_m", "low_confidence", "units_assigned", "lat", "lon", "message"];
  const lines = rows.map((i) =>
    [
      i.id,
      new Date(i.createdAt).toISOString(),
      i.status,
      i.source,
      i.result?.incident_type,
      i.result?.severity,
      i.result?.radius_m,
      i.result?.low_confidence,
      i.assigned.length,
      i.result?.pin?.lat,
      i.result?.pin?.lon,
      i.message,
    ]
      .map(esc)
      .join(","),
  );
  return new Response([header.join(","), ...lines].join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="kidhar-incidents.csv"' },
  });
}
