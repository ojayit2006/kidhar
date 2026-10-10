import { listIncidents } from "@/lib/store";

/** Incident queue: newest first. Persisted in data/incidents.json by lib/store.ts. */
export async function GET() {
  return Response.json({ incidents: listIncidents() });
}
