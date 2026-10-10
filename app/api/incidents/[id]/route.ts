import { staffGuard } from "@/lib/adminAuth";
import { TICKET_MIGRATION_HINT, getIncident, listIncidents, ticketColumnState, updateIncident, type Assigned, type Incident, type Status } from "@/lib/store";
import { applyTicketOps, RESOLUTIONS, type TicketOps } from "@/lib/ticket";
import { STATUS_LABEL } from "@/lib/sim";

const STATUSES: Status[] = ["new", "dispatched", "on_scene", "resolved"];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await staffGuard();
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const inc = await getIncident(id);
    if (!inc) return Response.json({ error: "Not found" }, { status: 404 });
    return Response.json({ incident: inc });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

type Body = {
  status?: Status;
  assign?: Omit<Assigned, "dispatchedAt">;
  ticket?: TicketOps;
};

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await staffGuard();
  if (denied) return denied;
  const { id } = await ctx.params;
  const body = (await req.json()) as Body;
  const by = (body.ticket?.by || "operator").slice(0, 40);
  try {
    const inc = await getIncident(id);
    if (!inc) return Response.json({ error: "Not found" }, { status: 404 });

    const patch: { status?: Status; assigned?: Assigned[]; ticket?: Incident["ticket"] } = {};
    let ticket = inc.ticket;
    let touchTicket = false;

    if (body.status && body.status !== inc.status) {
      if (!STATUSES.includes(body.status)) return Response.json({ error: "Bad status" }, { status: 400 });
      // Closing a ticket needs an outcome.
      if (body.status === "resolved") {
        const res = body.ticket?.resolution;
        if (!res || !RESOLUTIONS.some((r) => r.id === res.code)) return Response.json({ error: "Choose a resolution code to close this ticket." }, { status: 400 });
      }
      patch.status = body.status;
      ticket = { ...ticket, notes: [...ticket.notes, { at: Date.now(), by, kind: "system", text: `Status: ${STATUS_LABEL[inc.status]} to ${STATUS_LABEL[body.status]}` }] };
      touchTicket = true;
    }

    if (body.assign) {
      if (inc.assigned.some((a) => a.name === body.assign!.name)) return Response.json({ incident: inc });
      // A unit can only serve one open incident at a time.
      const busyAt = (await listIncidents()).find((i) => i.id !== id && i.status !== "resolved" && i.assigned.some((a) => a.name === body.assign!.name));
      if (busyAt) return Response.json({ error: `${body.assign.name} is already assigned to ${busyAt.id}.` }, { status: 409 });
      patch.assigned = [...inc.assigned, { ...body.assign, dispatchedAt: Date.now() }];
      if (inc.status === "new" && !patch.status) {
        patch.status = "dispatched";
        ticket = { ...ticket, notes: [...ticket.notes, { at: Date.now(), by: "system", kind: "system", text: "Status: New to Dispatched" }] };
      }
      ticket = { ...ticket, notes: [...ticket.notes, { at: Date.now(), by, kind: "system", text: `Unit dispatched: ${body.assign.name} (ETA ~${body.assign.eta_min} min)` }] };
      touchTicket = true;
    }

    if (body.ticket && (body.ticket.flag || body.ticket.assignee !== undefined || body.ticket.note || body.ticket.priority !== undefined || body.ticket.escalate || body.ticket.resolution)) {
      ticket = applyTicketOps(ticket, body.ticket, Date.now());
      touchTicket = true;
    }

    if (touchTicket) patch.ticket = ticket;
    const updated = await updateIncident(id, patch);
    // Status and unit changes still work before the ticket column exists, but the ticket part cannot be saved: say so.
    const warning = patch.ticket && ticketColumnState() === "missing" ? TICKET_MIGRATION_HINT : undefined;
    return Response.json({ incident: updated, warning });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
