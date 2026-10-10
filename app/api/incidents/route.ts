import { listIncidents } from "@/lib/store";

/** Incident queue, newest first. Stored in Supabase when configured, otherwise data/incidents.json. */
export async function GET() {
  try {
    return Response.json({ incidents: await listIncidents() });
  } catch (err: any) {
    return Response.json({ incidents: [], error: err.message }, { status: 500 });
  }
}
