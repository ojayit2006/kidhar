import { getIncident, updateIncident, type Assigned, type Status } from "@/lib/store";

const STATUSES: Status[] = ["new", "dispatched", "on_scene", "resolved"];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const inc = getIncident(id);
  if (!inc) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ incident: inc });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json()) as { status?: Status; assign?: Omit<Assigned, "dispatchedAt"> };
  const inc = getIncident(id);
  if (!inc) return Response.json({ error: "Not found" }, { status: 404 });

  const patch: { status?: Status; assigned?: Assigned[] } = {};
  if (body.status) {
    if (!STATUSES.includes(body.status)) return Response.json({ error: "Bad status" }, { status: 400 });
    patch.status = body.status;
  }
  if (body.assign) {
    if (inc.assigned.some((a) => a.name === body.assign!.name)) return Response.json({ incident: inc });
    patch.assigned = [...inc.assigned, { ...body.assign, dispatchedAt: Date.now() }];
    if (inc.status === "new") patch.status = "dispatched";
  }
  return Response.json({ incident: updateIncident(id, patch) });
}
