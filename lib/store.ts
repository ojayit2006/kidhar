import fs from "node:fs";
import path from "node:path";

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

const FILE = path.join(process.cwd(), "data", "incidents.json");

function readAll(): Incident[] {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeAll(items: Incident[]) {
  try {
    fs.writeFileSync(FILE, JSON.stringify(items));
  } catch {
    // read-only filesystem (e.g. serverless): incidents live only for this instance
  }
}

export function listIncidents(): Incident[] {
  return readAll().sort((a, b) => b.createdAt - a.createdAt);
}

export function getIncident(id: string): Incident | undefined {
  return readAll().find((i) => i.id === id);
}

export function createIncident(input: Pick<Incident, "message" | "result" | "units" | "dispatch"> & Partial<Pick<Incident, "gps" | "source">>): Incident {
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
  const all = readAll();
  all.push(inc);
  writeAll(all);
  return inc;
}

export function updateIncident(id: string, patch: Partial<Pick<Incident, "status" | "assigned">>): Incident | undefined {
  const all = readAll();
  const i = all.findIndex((x) => x.id === id);
  if (i < 0) return undefined;
  all[i] = { ...all[i], ...patch, updatedAt: Date.now() };
  writeAll(all);
  return all[i];
}
