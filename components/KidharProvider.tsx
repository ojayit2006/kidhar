"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Cand, Pin, UnitOut } from "./MapView";
import type { Incident, Status } from "@/lib/store";
import { progress } from "@/lib/sim";
import type { TicketOps } from "@/lib/ticket";

export type Gps = { lat: number; lon: number; accuracy_m: number };

export type Role = "control" | "fire" | "police" | "ambulance" | "citizen";
export type Lang = "en" | "hi" | "mr";

export const ROLES: { id: Role; label: string; blurb: string; prefers: UnitOut["type"] }[] = [
  { id: "control", label: "Control Room", blurb: "Triage every call, dispatch all services", prefers: "fire" },
  { id: "fire", label: "Fire Brigade", blurb: "Access, ETA and what is burning", prefers: "fire" },
  { id: "police", label: "Police", blurb: "Nearest chowky and crowd control", prefers: "police" },
  { id: "ambulance", label: "Ambulance / EMS", blurb: "Nearest hospital and patient status", prefers: "hospital" },
  { id: "citizen", label: "Citizen", blurb: "Describe where you are, get help moving", prefers: "fire" },
];

export const LANGS: { id: Lang; label: string; speech: string; sms: string }[] = [
  { id: "en", label: "English", speech: "en-IN", sms: "English" },
  { id: "hi", label: "हिन्दी", speech: "hi-IN", sms: "Hindi (Devanagari)" },
  { id: "mr", label: "मराठी", speech: "mr-IN", sms: "Marathi (Devanagari)" },
];

export type Check = { label: string; pass: boolean };
export type Result = {
  incident_type: string;
  severity: number;
  services: string[];
  follow_up_questions: string[];
  low_confidence: boolean;
  reasoning_steps: string[];
  checks: Check[];
  caller_language?: string;
  duplicate_of?: { id: string; distance_m: number; minutes_ago: number } | null;
};
export type Dispatch = { summary: string; dispatch_note: string; caller_sms: string };
export type Phase = "idle" | "locating" | "units" | "writing" | "done";

type Ctx = {
  role: Role;
  setRole: (r: Role) => void;
  lang: Lang;
  setLang: (l: Lang) => void;
  offline: boolean;
  message: string;
  setMessage: (m: string) => void;
  busy: boolean;
  phase: Phase;
  replay: boolean;
  setReplay: (b: boolean) => void;
  trace: string[];
  cands: Cand[];
  pin: Pin | null;
  units: UnitOut[];
  result: Result | null;
  dispatch: Dispatch | null;
  error: string;
  elapsed: number | null;
  run: (msg?: string, opts?: { gps?: Gps | null; source?: "dispatcher" | "citizen" }) => Promise<void>;
  reply: (text: string) => Promise<void>;
  incidents: Incident[];
  activeId: string | null;
  activeIncident: Incident | null;
  now: number;
  openIncident: (inc: Incident) => void;
  setStatus: (id: string, status: Status, resolution?: { code: string; note: string }) => Promise<boolean>;
  ticketOp: (id: string, ops: TicketOps) => Promise<boolean>;
  operator: string;
  setOperator: (name: string) => void;
  dispatchUnit: (u: UnitOut) => Promise<void>;
  refreshIncidents: () => Promise<void>;
  callerLog: string[];
  listening: boolean;
  listen: () => void;
  speak: (text: string) => void;
};

const C = createContext<Ctx | null>(null);
export const useKidhar = () => {
  const v = useContext(C);
  if (!v) throw new Error("KidharProvider missing");
  return v;
};

function stored(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function store(key: string, v: string) {
  try { localStorage.setItem(key, v); } catch {}
}

export default function KidharProvider({ children }: { children: ReactNode }) {
  const [role, setRoleS] = useState<Role>("control");
  const [lang, setLangS] = useState<Lang>("en");
  const [offline, setOffline] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [replay, setReplay] = useState(false);
  const [trace, setTrace] = useState<string[]>([]);
  const [cands, setCands] = useState<Cand[]>([]);
  const [pin, setPin] = useState<Pin | null>(null);
  const [units, setUnits] = useState<UnitOut[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [dispatch, setDispatch] = useState<Dispatch | null>(null);
  const [error, setError] = useState("");
  const [elapsed, setElapsed] = useState<number | null>(null);
  const [callerLog, setCallerLog] = useState<string[]>([]);
  const [listening, setListening] = useState(false);
  const t0 = useRef(0);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const lastExtra = useRef<{ gps?: Gps | null; source?: "dispatcher" | "citizen" }>({});

  const refreshIncidents = useCallback(async () => {
    try {
      const r = await fetch("/api/incidents", { cache: "no-store" });
      const d = await r.json();
      setIncidents(d.incidents ?? []);
    } catch {}
  }, []);

  // Live queue: poll, and tick a clock for simulated unit movement.
  useEffect(() => {
    refreshIncidents();
    const poll = setInterval(refreshIncidents, 4000);
    setNow(Date.now());
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [refreshIncidents]);

  const activeIncident = incidents.find((i) => i.id === activeId) ?? null;

  const [operator, setOperatorS] = useState("");
  useEffect(() => {
    setOperatorS(stored("kidhar.operator") ?? "");
  }, []);
  const setOperator = (name: string) => {
    setOperatorS(name);
    store("kidhar.operator", name);
  };

  /** PATCH an incident and surface the server's message (409 busy unit, 400 missing resolution, ...) instead of failing silently. */
  const patchIncident = useCallback(
    async (id: string, body: unknown) => {
      const r = await fetch(`/api/incidents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setError(d.error ?? `Request failed (${r.status})`);
        return false;
      }
      const d = await r.json().catch(() => ({}));
      setError(d.warning ?? "");
      await refreshIncidents();
      return true;
    },
    [refreshIncidents],
  );

  const setStatus = useCallback(
    async (id: string, status: Status, resolution?: { code: string; note: string }) =>
      patchIncident(id, { status, ticket: { by: operator || "operator", resolution } }),
    [patchIncident, operator],
  );

  const ticketOp = useCallback(
    async (id: string, ops: TicketOps) => patchIncident(id, { ticket: { ...ops, by: operator || "operator" } }),
    [patchIncident, operator],
  );

  const dispatchUnit = useCallback(
    async (u: UnitOut) => {
      if (!activeId) return;
      await patchIncident(activeId, {
        assign: { name: u.name, type: u.type, lat: u.lat, lon: u.lon, eta_min: u.eta_min },
        ticket: { by: operator || "operator" },
      });
    },
    [activeId, patchIncident, operator],
  );

  // When every assigned unit has arrived, the incident moves to "on scene".
  useEffect(() => {
    const inc = activeIncident;
    if (!inc || inc.status !== "dispatched" || inc.assigned.length === 0 || !now) return;
    if (inc.assigned.every((a) => progress(a, now) >= 1)) setStatus(inc.id, "on_scene");
  }, [activeIncident, now, setStatus]);

  const openIncident = useCallback((inc: Incident) => {
    setActiveId(inc.id);
    setMessage(inc.message);
    setCallerLog([inc.message]);
    setTrace([]);
    setCands([]);
    setError("");
    setElapsed(null);
    setPhase("done");
    const r = inc.result;
    if (r) {
      setResult({ ...r, checks: r.checks ?? [] });
      setPin({ lat: r.pin.lat, lon: r.pin.lon, radius_m: r.radius_m, low: r.low_confidence });
      setTrace(r.reasoning_steps ? r.reasoning_steps.map((s: string) => `→ ${s}`) : []);
    }
    setUnits(inc.units ?? []);
    setDispatch(inc.dispatch ?? null);
  }, []);

  useEffect(() => {
    const r = stored("kidhar.role") as Role | null;
    const l = stored("kidhar.lang") as Lang | null;
    if (r && ROLES.some((x) => x.id === r)) setRoleS(r);
    if (l && LANGS.some((x) => x.id === l)) setLangS(l);
    const up = () => setOffline(!navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);

  const setRole = (r: Role) => { setRoleS(r); store("kidhar.role", r); };
  const setLang = (l: Lang) => { setLangS(l); store("kidhar.lang", l); };

  const exec = useCallback(
    async (msg: string, keepCands: boolean, extra: { gps?: Gps | null; source?: "dispatcher" | "citizen" } = {}) => {
      setBusy(true);
      setPhase("locating");
      setTrace([]);
      if (!keepCands) setCands([]);
      setUnits([]);
      setResult(null);
      setDispatch(null);
      setError("");
      setElapsed(null);
      t0.current = Date.now();
      try {
        const res = await fetch("/api/locate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: msg, replay, sms_language: LANGS.find((x) => x.id === lang)!.sms, gps: extra.gps ?? null, source: extra.source ?? "dispatcher" }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setError(d.error ?? `Request failed (${res.status})`);
          setBusy(false);
          setPhase("idle");
          return;
        }
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const parts = buf.split("\n\n");
          buf = parts.pop() ?? "";
          for (const p of parts) {
            if (!p.startsWith("data: ")) continue;
            const e = JSON.parse(p.slice(6));
            if (e.type === "step" || e.type === "note") setTrace((t) => [...t, e.text]);
            else if (e.type === "lookup") {
              setCands((c) => [...c, ...e.candidates.slice(0, 3)]);
              setTrace((t) => [...t, `MAP DATA: ${e.candidates.length} candidate(s) for "${e.query}"${e.cached ? " (cached)" : ""}`]);
            } else if (e.type === "result") {
              setResult({ ...e, checks: e.checks ?? [] });
              setPin({ lat: e.pin.lat, lon: e.pin.lon, radius_m: e.radius_m, low: e.low_confidence });
              setTrace((t) => [...t, ...e.reasoning_steps.map((s: string) => `→ ${s}`)]);
              setPhase("units");
            } else if (e.type === "units") { setUnits(e.units); setPhase("writing"); }
            else if (e.type === "dispatch") setDispatch(e);
            else if (e.type === "saved") { setActiveId(e.id); refreshIncidents(); }
            else if (e.type === "error") setError(e.text);
            else if (e.type === "done") { setElapsed(Math.round((Date.now() - t0.current) / 1000)); setPhase("done"); }
          }
        }
      } catch (err: any) {
        setError(err.message);
      }
      setBusy(false);
    },
    [replay, lang, refreshIncidents],
  );

  const run = useCallback(
    async (msg?: string, opts?: { gps?: Gps | null; source?: "dispatcher" | "citizen" }) => {
      const m = (msg ?? message).trim();
      if (!m) return;
      lastExtra.current = opts ?? {};
      setCallerLog([m]);
      await exec(m, false, opts);
    },
    [message, exec],
  );

  /** Caller answers a follow-up question: re-run with the whole conversation so the circle can shrink. */
  const reply = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t || callerLog.length === 0) return;
      const log = [...callerLog, t];
      setCallerLog(log);
      const full = `${log[0]}\n${log.slice(1).map((x, i) => `Caller update ${i + 1}: ${x}`).join("\n")}`;
      await exec(full, true, lastExtra.current);
    },
    [callerLog, exec],
  );

  const speak = useCallback(
    (text: string) => {
      try {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = LANGS.find((x) => x.id === lang)!.speech;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch {}
    },
    [lang],
  );

  const listen = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("Voice input is not supported in this browser (try Chrome)."); return; }
    const rec = new SR();
    rec.lang = LANGS.find((x) => x.id === lang)!.speech;
    rec.interimResults = false;
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (ev: any) => setMessage(ev.results[0][0].transcript);
    rec.start();
  }, [lang]);

  return (
    <C.Provider value={{ role, setRole, lang, setLang, offline, message, setMessage, busy, phase, replay, setReplay, trace, cands, pin, units, result, dispatch, error, elapsed, run, reply, callerLog, listening, listen, speak, incidents, activeId, activeIncident, now, openIncident, setStatus, ticketOp, operator, setOperator, dispatchUnit, refreshIncidents }}>
      {children}
    </C.Provider>
  );
}
