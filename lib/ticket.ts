/**
 * Ticket layer on top of an incident: priority, flags, owner, notes/activity log, escalation, SLA and resolution.
 * Pure functions, safe to use on the server and in the browser.
 */

export type Priority = 1 | 2 | 3 | 4;

export type Note = { at: number; by: string; kind: "note" | "system"; text: string };

export type Resolution = { code: string; note: string; at: number; by: string };

export type Ticket = {
  priority: Priority;
  priorityManual: boolean;
  flags: string[];
  assignee: string | null;
  notes: Note[];
  escalated: boolean;
  resolution?: Resolution;
};

export type TicketOps = {
  flag?: { id: string; on: boolean };
  assignee?: string | null;
  note?: string;
  priority?: number;
  escalate?: boolean;
  resolution?: { code: string; note: string };
  by?: string;
};

export const FLAGS = [
  { id: "vulnerable", label: "Vulnerable person", hint: "Child, elderly or disabled person involved", color: "#dc2626" },
  { id: "mass_casualty", label: "Mass casualty", hint: "Several people hurt", color: "#b91c1c" },
  { id: "hazmat", label: "Hazmat / gas", hint: "Gas leak, chemicals or explosion risk", color: "#ea580c" },
  { id: "needs_callback", label: "Needs callback", hint: "Call the caller back to confirm details", color: "#2f7dff" },
  { id: "language_support", label: "Language support", hint: "Caller needs a Hindi, Marathi or other language operator", color: "#0f766e" },
  { id: "media", label: "Media / VIP", hint: "High-profile incident", color: "#6d28d9" },
  { id: "suspected_prank", label: "Suspected prank", hint: "Likely a false or abusive report", color: "#6b7280" },
  { id: "needs_supervisor", label: "Needs supervisor", hint: "A supervisor should review this ticket", color: "#d97706" },
  { id: "low_confidence", label: "Low-confidence location", hint: "Auto: the pin circle is wide or not fully grounded", color: "#d97706" },
  { id: "possible_duplicate", label: "Possible duplicate", hint: "Auto: another open incident is nearby", color: "#d97706" },
  { id: "gps_mismatch", label: "GPS mismatch", hint: "Auto: device GPS disagrees with the described place", color: "#d97706" },
  { id: "weather_delay", label: "Weather delay", hint: "Auto: rain or fog is slowing responders", color: "#2f7dff" },
  { id: "citizen_report", label: "Citizen report", hint: "Auto: reported through the public page", color: "#0f766e" },
  { id: "escalated", label: "Escalated", hint: "Escalated to a supervisor", color: "#dc2626" },
] as const;

export const flagMeta = (id: string) => FLAGS.find((f) => f.id === id);

export const RESOLUTIONS = [
  { id: "resolved_on_scene", label: "Resolved on scene" },
  { id: "transported", label: "Patient transported" },
  { id: "handed_over", label: "Handed over to another agency" },
  { id: "false_alarm", label: "False alarm" },
  { id: "prank", label: "Prank or abusive call" },
  { id: "duplicate", label: "Duplicate of another incident" },
  { id: "cancelled", label: "Caller cancelled" },
  { id: "unreachable", label: "Caller unreachable" },
] as const;

export const resolutionLabel = (id: string) => RESOLUTIONS.find((r) => r.id === id)?.label ?? id;

/** Target minutes to first dispatch, by priority. */
export const SLA_MINUTES: Record<Priority, number> = { 1: 2, 2: 5, 3: 10, 4: 30 };

export const PRIORITY_COLOR: Record<Priority, string> = { 1: "#b91c1c", 2: "#ea580c", 3: "#d97706", 4: "#16a34a" };

export const priorityFromSeverity = (sev?: number | null): Priority => (sev == null ? 3 : sev >= 5 ? 1 : sev >= 4 ? 2 : sev >= 3 ? 3 : 4);

type IncidentLike = {
  createdAt: number;
  status: string;
  source?: string;
  result?: any;
  assigned: { dispatchedAt: number }[];
  ticket?: Ticket | null;
};

/** Build the starting ticket for a new incident, including automatic flags. */
export function initialTicket(i: { createdAt: number; source?: string; result?: any }): Ticket {
  const r = i.result ?? {};
  const priority = priorityFromSeverity(r.severity);
  const flags: string[] = [];
  if (r.low_confidence) flags.push("low_confidence");
  if (r.duplicate_of) flags.push("possible_duplicate");
  if (Array.isArray(r.checks) && r.checks.some((c: { label: string; pass: boolean }) => c.label.startsWith("Device GPS") && !c.pass)) flags.push("gps_mismatch");
  if (r.impact && r.impact.etaFactor > 1) flags.push("weather_delay");
  if (i.source === "citizen") flags.push("citizen_report");

  const notes: Note[] = [
    { at: i.createdAt, by: "system", kind: "system", text: `Ticket created (${i.source ?? "dispatcher"}). Priority P${priority}, severity ${r.severity ?? "?"}/5.` },
    ...flags.map((f) => ({ at: i.createdAt, by: "system", kind: "system" as const, text: `Auto-flagged: ${flagMeta(f)?.label ?? f}` })),
  ];
  return { priority, priorityManual: false, flags, assignee: null, notes, escalated: false };
}

/** Old incidents saved before tickets existed get a derived ticket. */
export const ticketOf = (i: IncidentLike): Ticket => i.ticket ?? initialTicket(i);

export type SlaState = "met" | "missed" | "ok" | "warn" | "breached" | "closed";

export function slaInfo(i: IncidentLike, now: number) {
  const t = ticketOf(i);
  const targetMs = SLA_MINUTES[t.priority] * 60_000;
  const firstDispatch = i.assigned.length ? Math.min(...i.assigned.map((a) => a.dispatchedAt)) : null;
  if (firstDispatch != null) {
    const took = firstDispatch - i.createdAt;
    return { state: (took <= targetMs ? "met" : "missed") as SlaState, targetMs, elapsedMs: took, remainingMs: targetMs - took };
  }
  if (i.status !== "new") return { state: "closed" as SlaState, targetMs, elapsedMs: 0, remainingMs: 0 };
  const elapsed = Math.max(0, now - i.createdAt);
  const remaining = targetMs - elapsed;
  const state: SlaState = remaining < 0 ? "breached" : remaining < targetMs * 0.34 ? "warn" : "ok";
  return { state, targetMs, elapsedMs: elapsed, remainingMs: remaining };
}

export function fmtDuration(ms: number) {
  const s = Math.floor(Math.abs(ms) / 1000);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

export const SLA_COLOR: Record<SlaState, string> = { met: "#16a34a", missed: "#dc2626", ok: "#16a34a", warn: "#d97706", breached: "#dc2626", closed: "#6b7280" };

/** Apply operator actions to a ticket and log each one in the activity trail. */
export function applyTicketOps(ticket: Ticket, ops: TicketOps, now = Date.now()): Ticket {
  const by = (ops.by || "operator").slice(0, 40);
  const t: Ticket = { ...ticket, flags: [...ticket.flags], notes: [...ticket.notes] };
  const log = (text: string) => t.notes.push({ at: now, by, kind: "system", text });

  if (ops.flag) {
    const meta = flagMeta(ops.flag.id);
    if (meta) {
      const has = t.flags.includes(ops.flag.id);
      if (ops.flag.on && !has) {
        t.flags.push(ops.flag.id);
        log(`Flag added: ${meta.label}`);
      } else if (!ops.flag.on && has) {
        t.flags = t.flags.filter((f) => f !== ops.flag!.id);
        log(`Flag removed: ${meta.label}`);
      }
    }
  }
  if (ops.assignee !== undefined) {
    const next = ops.assignee ? ops.assignee.slice(0, 40) : null;
    if (next !== t.assignee) {
      log(next ? `Ticket taken by ${next}` : `Ticket released by ${t.assignee}`);
      t.assignee = next;
    }
  }
  if (ops.priority !== undefined && [1, 2, 3, 4].includes(ops.priority) && ops.priority !== t.priority) {
    log(`Priority changed P${t.priority} to P${ops.priority}`);
    t.priority = ops.priority as Priority;
    t.priorityManual = true;
  }
  if (ops.escalate && !t.escalated) {
    t.escalated = true;
    if (!t.flags.includes("escalated")) t.flags.push("escalated");
    if (!t.flags.includes("needs_supervisor")) t.flags.push("needs_supervisor");
    if (t.priority > 1) {
      log(`Priority raised P${t.priority} to P${t.priority - 1}`);
      t.priority = (t.priority - 1) as Priority;
    }
    log("Escalated to supervisor");
  }
  if (ops.note && ops.note.trim()) t.notes.push({ at: now, by, kind: "note", text: ops.note.trim().slice(0, 500) });
  if (ops.resolution) {
    t.resolution = { code: ops.resolution.code, note: (ops.resolution.note ?? "").slice(0, 500), at: now, by };
    log(`Closed: ${resolutionLabel(ops.resolution.code)}${ops.resolution.note ? `. ${ops.resolution.note.slice(0, 200)}` : ""}`);
  }
  return t;
}

/** Sort key for the queue: priority first, then least time left on the response target. */
export function queueRank(i: IncidentLike, now: number) {
  const t = ticketOf(i);
  const sla = slaInfo(i, now);
  return t.priority * 1e12 + (sla.state === "ok" || sla.state === "warn" || sla.state === "breached" ? sla.remainingMs : 1e11) + 0;
}
