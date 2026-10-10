import { isAdmin } from "@/lib/adminAuth";
import { deleteIncident } from "@/lib/store";

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  try {
    const ok = await deleteIncident(id);
    return ok ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
