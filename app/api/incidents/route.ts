import { staffGuard } from "@/lib/adminAuth";
import { listIncidents } from "@/lib/store";

/** Incident queue, newest first. Staff only: it contains caller messages and GPS locations. */
export async function GET() {
  const denied = await staffGuard();
  if (denied) return denied;
  try {
    return Response.json({ incidents: await listIncidents() });
  } catch (err: any) {
    return Response.json({ incidents: [], error: err.message }, { status: 500 });
  }
}
