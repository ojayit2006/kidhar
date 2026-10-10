import { getIncident } from "@/lib/store";

/**
 * Public tracking view for the person who reported the emergency. The incident id is an unguessable
 * token, and only the fields a caller needs are returned (no other callers' messages, no GPS, no internals).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  try {
    const inc = await getIncident(id);
    if (!inc) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({
      track: {
        id: inc.id,
        status: inc.status,
        pin: inc.result ? { lat: inc.result.pin.lat, lon: inc.result.pin.lon, radius_m: inc.result.radius_m, low: inc.result.low_confidence } : null,
        assigned: inc.assigned,
        caller_sms: inc.dispatch?.caller_sms ?? null,
        incident_type: inc.result?.incident_type ?? null,
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
