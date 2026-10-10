import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

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
  gps?: { lat: number; lon: number; accuracy_m: number } | null;
  source: "dispatcher" | "citizen";
};

type NewIncident = Pick<Incident, "message" | "result" | "units" | "dispatch"> & Partial<Pick<Incident, "gps" | "source">>;

/**
 * Storage: Supabase when SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set (table in supabase/schema.sql),
 * otherwise a JSON file for local development. The service key is used only on the server.
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const sb = SUPABASE_URL && SUPABASE_KEY ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } }) : null;

export const storeBackend: "supabase" | "file" = sb ? "supabase" : "file";

const FILE = path.join(process.cwd(), "data", "incidents.json");

function readFile(): Incident[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
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

function toRow(i: Incident) {
  return {
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
}

function fromRow(r: any): Incident {
  return {
    id: r.id,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    status: r.status,
    source: r.source,
    message: r.message,
    gps: r.gps,
    result: r.result,
    units: r.units ?? [],
    dispatch: r.dispatch,
    assigned: r.assigned ?? [],
  };
}

export async function listIncidents(): Promise<Incident[]> {
  if (sb) {
    const { data, error } = await sb.from("incidents").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) throw new Error(`Supabase: ${error.message}`);
    return (data ?? []).map(fromRow);
  }
  return readFile().sort((a, b) => b.createdAt - a.createdAt);
}

export async function getIncident(id: string): Promise<Incident | undefined> {
  if (sb) {
    const { data, error } = await sb.from("incidents").select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(`Supabase: ${error.message}`);
    return data ? fromRow(data) : undefined;
  }
  return readFile().find((i) => i.id === id);
}

export async function createIncident(input: NewIncident): Promise<Incident> {
  const now = Date.now();
  const inc: Incident = {
    id: `INC-${now.toString(36).toUpperCase().slice(-6)}`,
    createdAt: now,
    updatedAt: now,
    status: "new",
    assigned: [],
    gps: input.gps ?? null,
    source: input.source ?? "dispatcher",
    message: input.message,
    result: input.result,
    units: input.units,
    dispatch: input.dispatch,
  };
  if (sb) {
    const { error } = await sb.from("incidents").insert(toRow(inc));
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

export async function updateIncident(id: string, patch: Partial<Pick<Incident, "status" | "assigned">>): Promise<Incident | undefined> {
  const cur = await getIncident(id);
  if (!cur) return undefined;
  const next: Incident = { ...cur, ...patch, updatedAt: Date.now() };
  if (sb) {
    const { error } = await sb.from("incidents").update({ status: next.status, assigned: next.assigned, updated_at: next.updatedAt }).eq("id", id);
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
