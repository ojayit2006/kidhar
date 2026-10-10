import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { initialTicket, type Ticket } from "./ticket";

export type Status = "new" | "dispatched" | "on_scene" | "resolved";

export type Assigned = { name: string; type: "police" | "fire" | "hospital"; lat: number; lon: number; eta_min: number; dispatchedAt: number };

export type Incident = {
  id: string;
  createdAt: number;
  updatedAt: number;
  message: string;
  status: Status;
  result: any;
  units: any[];
  dispatch: any;
  assigned: Assigned[];
  ticket: Ticket;
  gps?: { lat: number; lon: number; accuracy_m: number } | null;
  source: "dispatcher" | "citizen";
};

type NewIncident = Pick<Incident, "message" | "result" | "units" | "dispatch"> & Partial<Pick<Incident, "gps" | "source">>;

/**
 * Storage: Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (table in supabase/schema.sql),
 * otherwise a JSON file for local development. The service key is used only on the server.
 *
 * Tickets live in a jsonb "ticket" column (supabase/migrations/002_ticket.sql). Until that column exists the app keeps
 * working: incidents are saved without it and a default ticket is derived on read, but ticket edits are refused.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } }) : null;

export const storeBackend: "supabase" | "file" = sb ? "supabase" : "file";

let ticketColumn: boolean | null = sb ? null : true; // null = not known yet
export const ticketColumnState = (): "ok" | "missing" | "unknown" => (ticketColumn === null ? "unknown" : ticketColumn ? "ok" : "missing");

export const TICKET_MIGRATION_HINT = "Ticket storage is not enabled yet. Run supabase/migrations/002_ticket.sql in the Supabase SQL editor.";
const isTicketColumnError = (msg: string) => /ticket/i.test(msg) && /(column|schema cache)/i.test(msg);

const FILE = path.join(process.cwd(), "data", "incidents.json");

function normalize(i: Incident): Incident {
  return { ...i, ticket: i.ticket ?? initialTicket({ createdAt: i.createdAt, source: i.source, result: i.result }) };
}

function readFile(): Incident[] {
  try {
    return (JSON.parse(fs.readFileSync(FILE, "utf8")) as Incident[]).map(normalize);
  } catch {
    return [];
  }
}

function writeFile(items: Incident[]) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(items));
  } catch {
    // read-only filesystem (e.g. serverless): use Supabase there
  }
}

function toRow(i: Incident, withTicket: boolean) {
  const row: Record<string, unknown> = {
    id: i.id,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
    status: i.status,
    source: i.source,
    message: i.message,
    gps: i.gps ?? null,
    result: i.result ?? null,
    units: i.units ?? [],
    dispatch: i.dispatch ?? null,
    assigned: i.assigned ?? [],
  };
  if (withTicket) row.ticket = i.ticket;
  return row;
}

function fromRow(r: any): Incident {
  const createdAt = Number(r.created_at);
  return {
    id: r.id,
    createdAt,
    updatedAt: Number(r.updated_at),
    status: r.status,
    source: r.source,
    message: r.message,
    gps: r.gps,
    result: r.result,
    units: r.units ?? [],
    dispatch: r.dispatch,
    assigned: r.assigned ?? [],
    ticket: r.ticket ?? initialTicket({ createdAt, source: r.source, result: r.result }),
  };
}

export async function listIncidents(): Promise<Incident[]> {
  if (sb) {
    const { data, error } = await sb.from("incidents").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (data && data.length) ticketColumn = "ticket" in data[0];
    return (data ?? []).map(fromRow);
  }
  return readFile().sort((a, b) => b.createdAt - a.createdAt);
}

export async function getIncident(id: string): Promise<Incident | undefined> {
  if (sb) {
    const { data, error } = await sb.from("incidents").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (data) ticketColumn = "ticket" in data;
    return data ? fromRow(data) : undefined;
  }
  return readFile().find((i) => i.id === id);
}

export async function createIncident(input: NewIncident): Promise<Incident> {
  const now = Date.now();
  const source = input.source ?? "dispatcher";
  const inc: Incident = {
    id: `INC-${crypto.randomBytes(6).toString("base64url").replace(/[-_]/g, "").slice(0, 8).toUpperCase()}`,
    createdAt: now,
    updatedAt: now,
    status: "new",
    assigned: [],
    gps: input.gps ?? null,
    source,
    message: input.message,
    result: input.result,
    units: input.units,
    dispatch: input.dispatch,
    ticket: initialTicket({ createdAt: now, source, result: input.result }),
  };
  if (sb) {
    let { error } = await sb.from("incidents").insert(toRow(inc, ticketColumn !== false));
    if (error && isTicketColumnError(error.message)) {
      ticketColumn = false;
      ({ error } = await sb.from("incidents").insert(toRow(inc, false)));
    }
    if (error) throw new Error(`Supabase: ${error.message}`);
    return inc;
  }
  const all = readFile();
  all.push(inc);
  writeFile(all);
  return inc;
}

/** Never throws: a storage problem must not break the live locate flow. */
export async function createIncidentSafe(input: NewIncident): Promise<Incident | null> {
  try {
    return await createIncident(input);
  } catch (err) {
    console.error("createIncident failed:", err);
    return null;
  }
}

export async function updateIncident(id: string, patch: Partial<Pick<Incident, "status" | "assigned" | "ticket">>): Promise<Incident | undefined> {
  const cur = await getIncident(id);
  if (!cur) return undefined;
  const next: Incident = { ...cur, ...patch, updatedAt: Date.now() };
  if (sb) {
    // Status and unit changes must keep working before the ticket column exists; only pure ticket edits are refused.
    const ticketOnly = !patch.status && !patch.assigned;
    if (patch.ticket && ticketColumn === false && ticketOnly) throw new Error(TICKET_MIGRATION_HINT);
    const withTicket = Boolean(patch.ticket) && ticketColumn !== false;
    const build = (includeTicket: boolean) => {
      const body: Record<string, unknown> = { status: next.status, assigned: next.assigned, updated_at: next.updatedAt };
      if (includeTicket) body.ticket = next.ticket;
      return body;
    };
    let { error } = await sb.from("incidents").update(build(withTicket)).eq("id", id);
    if (error && withTicket && isTicketColumnError(error.message)) {
      ticketColumn = false;
      if (ticketOnly) throw new Error(TICKET_MIGRATION_HINT);
      ({ error } = await sb.from("incidents").update(build(false)).eq("id", id));
    }
    if (error) throw new Error(`Supabase: ${error.message}`);
    return next;
  }
  const all = readFile();
  const i = all.findIndex((x) => x.id === id);
  all[i] = next;
  writeFile(all);
  return next;
}

export async function deleteIncident(id: string): Promise<boolean> {
  if (sb) {
    const { error } = await sb.from("incidents").delete().eq("id", id);
    if (error) throw new Error(`Supabase: ${error.message}`);
    return true;
  }
  const all = readFile();
  const next = all.filter((x) => x.id !== id);
  writeFile(next);
  return next.length !== all.length;
}
