"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Activity, Download, Lock, LogOut, Timer, Trash2, TriangleAlert } from "lucide-react";
import { Badge, Card, MetricBlock, SEVERITY_COLORS } from "@/components/ui";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/sim";
import type { Status } from "@/lib/store";

type Row = { id: string; createdAt: number; status: Status; source: string; message: string; type: string | null; severity: number | null; radius_m: number | null; lowConfidence: boolean; units: number };
type Overview = {
  stats: { total: number; last24h: number; open: number; avgSeverity: number | null; avgFastestEta: number | null; lowConfidence: number; byStatus: Record<string, number>; byType: Record<string, number>; bySource: Record<string, number> };
  tickets: { byPriority: Record<string, number>; byFlag: Record<string, number>; byResolution: Record<string, number>; escalated: number; unassignedOpen: number; slaCompliancePct: number | null; overdueNow: number; avgTimeToDispatchSec: number | null };
  health: { storeBackend: string; ticketStorage: string; storeOk: boolean; storeError: string; anthropicKey: boolean; units: { fire: number; police: number; hospital: number }; replayEntries: number; geocacheEntries: number; limits: { maxMessageChars: number; callsPerMinute: number } };
  incidents: Row[];
};

const STATUSES: Status[] = ["new", "dispatched", "on_scene", "resolved"];

function Bars({ data, colors }: { data: Record<string, number>; colors?: (k: string) => string }) {
  const max = Math.max(1, ...Object.values(data));
  const entries = Object.entries(data);
  if (entries.length === 0) return <p className="text-sm text-gray-500">No data yet.</p>;
  return (
    <ul className="space-y-2">
      {entries.map(([k, v]) => (
        <li key={k} className="flex items-center gap-3 text-sm">
          <span className="w-24 truncate capitalize text-gray-300">{k.replace("_", " ")}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/60">
            <div className="h-full rounded-full" style={{ width: `${(v / max) * 100}%`, background: colors?.(k) ?? "linear-gradient(90deg,#2f7dff,#0fb5b0)" }} />
          </div>
          <span className="mono w-6 text-right text-xs text-gray-400">{v}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Admin() {
  const [data, setData] = useState<Overview | null>(null);
  const [state, setState] = useState<"loading" | "login" | "disabled" | "ready">("loading");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState<Status | "all">("all");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/overview", { cache: "no-store" });
    if (r.status === 503) return setState("disabled");
    if (r.status === 401) return setState("login");
    setData(await r.json());
    setState("ready");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state !== "ready") return;
    const t = setInterval(load, 8000);
    return () => clearInterval(t);
  }, [state, load]);

  async function login(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    if (!r.ok) return setErr((await r.json()).error ?? "Login failed");
    setPassword("");
    load();
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setData(null);
    setState("login");
  }

  async function setStatus(id: string, status: Status) {
    await fetch(`/api/incidents/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  async function remove(id: string) {
    const r = await fetch(`/api/admin/incidents/${id}`, { method: "DELETE" });
    setConfirm(null);
    setNote(r.ok ? `Deleted ${id}` : (await r.json()).error);
    load();
  }

  async function clearCache(target: "replay" | "geocache") {
    const r = await fetch("/api/admin/cache", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target }) });
    setConfirm(null);
    setNote(r.ok ? `Cleared ${target} cache` : (await r.json()).error);
    load();
  }

  if (state === "loading") return <div className="mx-auto max-w-md px-6 py-16 text-sm text-gray-400">Loading…</div>;

  if (state === "disabled")
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <Card title="Admin disabled">
          <p className="text-sm text-gray-300">
            Set <code className="mono">ADMIN_PASSWORD</code> in the server environment (<code className="mono">.env.local</code>) and restart to enable the admin panel.
          </p>
        </Card>
      </div>
    );

  if (state === "login")
    return (
      <div className="mx-auto max-w-sm px-6 py-16">
        <Card>
          <form onSubmit={login} className="space-y-4">
            <div className="flex items-center gap-2">
              <Lock size={18} className="text-brand-to" />
              <h1 className="font-display text-2xl font-bold">Admin</h1>
            </div>
            <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="field w-full rounded-xl px-3 py-2.5 text-sm" />
            {err && <p className="text-sm text-risk-severe">{err}</p>}
            <button type="submit" disabled={!password} className="w-full rounded-xl bg-gradient-to-r from-brand-from to-brand-to py-2.5 font-semibold text-white shadow-glow disabled:opacity-50">
              Sign in
            </button>
          </form>
        </Card>
      </div>
    );

  const d = data!;
  const rows = d.incidents.filter((i) => filter === "all" || i.status === filter);
  const h = d.health;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-sm text-gray-400">Operations overview. Refreshes every 8 seconds.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/admin/export" className="glass flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold">
            <Download size={14} /> Export CSV
          </a>
          <button type="button" onClick={logout} className="glass flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </div>

      {note && <div className="glass rounded-xl px-4 py-2 text-sm">{note}</div>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MetricBlock icon={<Activity size={18} />} label="Total incidents" value={String(d.stats.total)} />
        <MetricBlock icon={<Activity size={18} />} label="Last 24h" value={String(d.stats.last24h)} />
        <MetricBlock icon={<TriangleAlert size={18} />} label="Open" value={String(d.stats.open)} />
        <MetricBlock icon={<Activity size={18} />} label="Avg severity" value={d.stats.avgSeverity?.toString() ?? "—"} />
        <MetricBlock icon={<Timer size={18} />} label="Avg fastest ETA" value={d.stats.avgFastestEta != null ? `~${d.stats.avgFastestEta} min` : "—"} />
        <MetricBlock icon={<TriangleAlert size={18} />} label="Low confidence" value={String(d.stats.lowConfidence)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="By status">
          <Bars data={d.stats.byStatus} colors={(k) => STATUS_COLOR[k as Status] ?? "#2f7dff"} />
        </Card>
        <Card title="By type">
          <Bars data={d.stats.byType} />
        </Card>
        <Card title="By source">
          <Bars data={d.stats.bySource} />
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <MetricBlock icon={<Timer size={18} />} label="Response target met" value={d.tickets.slaCompliancePct != null ? `${d.tickets.slaCompliancePct}%` : "—"} />
        <MetricBlock icon={<Timer size={18} />} label="Avg time to dispatch" value={d.tickets.avgTimeToDispatchSec != null ? `${d.tickets.avgTimeToDispatchSec}s` : "—"} />
        <MetricBlock icon={<TriangleAlert size={18} />} label="Overdue now" value={String(d.tickets.overdueNow)} />
        <MetricBlock icon={<TriangleAlert size={18} />} label="Escalated" value={String(d.tickets.escalated)} />
        <MetricBlock icon={<Activity size={18} />} label="Open, unassigned" value={String(d.tickets.unassignedOpen)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Tickets by priority">
          <Bars data={d.tickets.byPriority} />
        </Card>
        <Card title="Flags in use">
          <Bars data={d.tickets.byFlag} />
        </Card>
        <Card title="Outcomes">
          <Bars data={d.tickets.byResolution} />
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="System health" className="lg:col-span-2">
          <ul className="grid gap-2 text-sm sm:grid-cols-2">
            <li className="flex items-center justify-between rounded-xl bg-white/50 p-3">
              <span>Storage</span>
              <Badge color={h.storeOk ? "#16a34a" : "#dc2626"}>
                {h.storeBackend} · {h.storeOk ? "ok" : "error"}
              </Badge>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-white/50 p-3">
              <span>Ticket storage</span>
              <Badge color={h.ticketStorage === "ok" ? "#16a34a" : h.ticketStorage === "missing" ? "#dc2626" : "#d97706"}>
                {h.ticketStorage === "missing" ? "run migration 002" : h.ticketStorage}
              </Badge>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-white/50 p-3">
              <span>AI API key</span>
              <Badge color={h.anthropicKey ? "#16a34a" : "#dc2626"}>{h.anthropicKey ? "configured" : "missing"}</Badge>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-white/50 p-3">
              <span>Units loaded</span>
              <span className="mono text-xs">
                {h.units.fire} fire · {h.units.police} police · {h.units.hospital} hospital
              </span>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-white/50 p-3">
              <span>Limits</span>
              <span className="mono text-xs">
                {h.limits.maxMessageChars} chars · {h.limits.callsPerMinute}/min
              </span>
            </li>
          </ul>
          {!h.storeOk && <p className="mt-3 text-sm text-risk-severe">{h.storeError}</p>}
          {h.storeBackend === "file" && <p className="mt-3 text-xs text-gray-500">Using the local JSON file. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use Supabase.</p>}
        </Card>

        <Card title="Maintenance">
          <div className="space-y-3 text-sm">
            {(["replay", "geocache"] as const).map((t) => (
              <div key={t} className="flex items-center justify-between gap-2">
                <span className="text-gray-300">
                  {t === "replay" ? "Replay cache" : "Map lookup cache"} <span className="mono text-xs text-gray-500">({t === "replay" ? h.replayEntries : h.geocacheEntries})</span>
                </span>
                {confirm === `cache:${t}` ? (
                  <span className="flex gap-1">
                    <button type="button" onClick={() => clearCache(t)} className="rounded-lg bg-risk-severe px-2.5 py-1 text-xs font-semibold text-white">
                      Confirm
                    </button>
                    <button type="button" onClick={() => setConfirm(null)} className="rounded-lg bg-white/70 px-2.5 py-1 text-xs">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => setConfirm(`cache:${t}`)} className="rounded-lg bg-white/70 px-2.5 py-1 text-xs font-semibold">
                    Clear
                  </button>
                )}
              </div>
            ))}
            <p className="text-[11px] text-gray-500">Clearing the replay cache removes the offline demo runs.</p>
          </div>
        </Card>
      </div>

      <Card
        title={`Incidents · ${rows.length}`}
        action={
          <select value={filter} onChange={(e) => setFilter(e.target.value as Status | "all")} className="field rounded-md px-2 py-1 text-xs" aria-label="Filter by status">
            <option value="all">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        }
      >
        {rows.length === 0 ? (
          <p className="text-sm text-gray-500">No incidents.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="py-2 pr-3">ID</th>
                  <th className="pr-3">Type</th>
                  <th className="pr-3">Message</th>
                  <th className="pr-3">Source</th>
                  <th className="pr-3">Status</th>
                  <th className="pr-3">Units</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((i) => (
                  <tr key={i.id} className="border-t border-white/50 align-top">
                    <td className="mono py-2 pr-3 text-xs">
                      <Link href={`/incidents/${i.id}`} className="text-brand-from hover:underline">
                        {i.id}
                      </Link>
                      <div className="text-gray-500">{new Date(i.createdAt).toLocaleTimeString()}</div>
                    </td>
                    <td className="pr-3">
                      {i.type ? (
                        <Badge color={SEVERITY_COLORS[i.severity ?? 0]}>
                          {i.type} · {i.severity}/5
                        </Badge>
                      ) : (
                        "—"
                      )}
                      {i.lowConfidence && <div className="mt-1 text-[11px] text-risk-moderate">low confidence</div>}
                    </td>
                    <td className="max-w-[320px] pr-3 text-gray-300">
                      <span className="line-clamp-2">{i.message}</span>
                    </td>
                    <td className="pr-3 capitalize">{i.source}</td>
                    <td className="pr-3">
                      <select value={i.status} onChange={(e) => setStatus(i.id, e.target.value as Status)} className="field rounded-md px-2 py-1 text-xs" aria-label={`Status of ${i.id}`}>
                        {STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {STATUS_LABEL[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="mono pr-3 text-xs">{i.units}</td>
                    <td className="text-right">
                      {confirm === i.id ? (
                        <span className="flex justify-end gap-1">
                          <button type="button" onClick={() => remove(i.id)} className="rounded-lg bg-risk-severe px-2.5 py-1 text-xs font-semibold text-white">
                            Delete
                          </button>
                          <button type="button" onClick={() => setConfirm(null)} className="rounded-lg bg-white/70 px-2.5 py-1 text-xs">
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirm(i.id)} aria-label={`Delete ${i.id}`} className="rounded-lg p-1.5 text-gray-400 hover:bg-white/70 hover:text-risk-severe">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
