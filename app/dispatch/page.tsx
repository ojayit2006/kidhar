"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Mic, Volume2, Send, Timer, Siren, MapPinned, Truck, Check, X, Loader2 } from "lucide-react";
import { ROLES, useKidhar } from "@/components/KidharProvider";
import { Badge, Card, Gauge, MetricBlock, SEVERITY_COLORS, Tag } from "@/components/ui";
import WeatherCard from "@/components/WeatherCard";
import TicketPanel from "@/components/TicketPanel";
import ForecastCard from "@/components/ForecastCard";
import { STATUS_COLOR, STATUS_LABEL, progress, remainingMin } from "@/lib/sim";
import { PRIORITY_COLOR, SLA_COLOR, flagMeta, fmtDuration, queueRank, slaInfo, ticketOf } from "@/lib/ticket";
import type { Status } from "@/lib/store";

const STATUS_ORDER: Status[] = ["new", "dispatched", "on_scene", "resolved"];

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const PRESETS = [
  { label: "🔥 Fire, Dadar", text: "Dadar West mein Kirti College ke peeche wali building mein aag lagi hai, Shivaji Park ki taraf se dhuan dikh raha hai, jaldi aao!" },
  { label: "🚑 Medical, Bandra", text: "Bandra station se bahar nikal ke Lucky restaurant ke saamne ek uncle gir gaye hain, saans nahi le rahe" },
  { label: "❓ Vague, Andheri", text: "Andheri mein metro ke neeche accident hua hai" },
];
const ICON = { fire: "🚒", police: "🚓", hospital: "🏥" } as const;
const TABS = ["Reasoning", "Units", "Dispatch card", "Grounding"] as const;
const STEPS = [
  { key: "locating", label: "Locate" },
  { key: "units", label: "Units" },
  { key: "writing", label: "Dispatch" },
] as const;

export default function Dispatch() {
  const k = useKidhar();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Reasoning");
  const [replyText, setReplyText] = useState("");
  const [qFilter, setQFilter] = useState<"all" | "mine" | "escalated" | "overdue">("all");
  const prefers = ROLES.find((r) => r.id === k.role)!.prefers;

  const units = [...k.units].sort((a, b) => (a.type === prefers ? -1 : 0) - (b.type === prefers ? -1 : 0) || a.distance_m - b.distance_m);
  const fastest = k.units.length ? Math.min(...k.units.map((u) => u.eta_min)) : null;
  const confidence = k.pin ? Math.max(0, Math.min(1, 1 - (k.pin.radius_m - 50) / 2950)) : 0;
  const confColor = confidence > 0.8 ? "#16a34a" : confidence > 0.5 ? "#d97706" : "#dc2626";
  const sevColor = k.result ? SEVERITY_COLORS[k.result.severity] ?? "#f59e0b" : "#6b7280";
  const phaseIdx = STEPS.findIndex((s) => s.key === k.phase);
  const inc = k.activeIncident;
  const assigned = inc?.assigned ?? [];
  const nowMs = k.now || Date.now();
  const me = k.operator.trim();
  const open = k.incidents.filter((i) => i.status !== "resolved");
  const queue = open
    .filter((i) => {
      const t = ticketOf(i);
      if (qFilter === "mine") return me !== "" && t.assignee === me;
      if (qFilter === "escalated") return t.escalated;
      if (qFilter === "overdue") return slaInfo(i, nowMs).state === "breached";
      return true;
    })
    .sort((a, b) => queueRank(a, nowMs) - queueRank(b, nowMs) || b.createdAt - a.createdAt);
  const overdueCount = open.filter((i) => slaInfo(i, nowMs).state === "breached").length;

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-6 py-8 lg:grid-cols-3">
      <div className="min-w-0 space-y-6 lg:col-span-2">
        {/* Live queue */}
        <Card
          title={`Live queue · ${open.length} open${overdueCount ? ` · ${overdueCount} overdue` : ""}`}
          action={
            <div className="flex gap-1">
              {(["all", "mine", "escalated", "overdue"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setQFilter(f)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize ${qFilter === f ? "bg-gradient-to-r from-brand-from to-brand-to text-white" : "bg-white/60 text-gray-300 hover:bg-white/90"}`}
                >
                  {f}
                </button>
              ))}
            </div>
          }
          className="!p-3"
        >
          {queue.length === 0 ? (
            <p className="px-2 pb-1 text-sm text-gray-500">{open.length === 0 ? "No open incidents. Run a call and it will appear here." : "No tickets match this filter."}</p>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {queue.map((q) => {
                const sev = q.result?.severity ?? 0;
                const t = ticketOf(q);
                const sla = slaInfo(q, nowMs);
                const slaShown = sla.state === "ok" || sla.state === "warn" || sla.state === "breached";
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => k.openIncident(q)}
                    className={`min-w-[230px] rounded-xl p-3 text-left text-sm transition ${k.activeId === q.id ? "bg-white/90 shadow-glow" : "bg-white/50 hover:bg-white/70"}`}
                    style={t.escalated ? { borderLeft: "4px solid #dc2626" } : undefined}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <Badge color={PRIORITY_COLOR[t.priority]}>P{t.priority}</Badge>
                        <span className="mono text-[11px] text-gray-500">{q.id}</span>
                      </span>
                      <Badge color={STATUS_COLOR[q.status]}>{STATUS_LABEL[q.status]}</Badge>
                    </div>
                    <div className="font-semibold uppercase" style={{ color: SEVERITY_COLORS[sev] }}>
                      {q.result?.incident_type} · {sev}/5
                    </div>
                    <div className="line-clamp-2 text-xs text-gray-400">{q.dispatch?.summary || q.message}</div>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                      {slaShown ? (
                        <span className="mono font-semibold" style={{ color: SLA_COLOR[sla.state] }}>
                          {sla.state === "breached" ? `+${fmtDuration(sla.remainingMs)} overdue` : `${fmtDuration(sla.remainingMs)} left`}
                        </span>
                      ) : (
                        <span className="text-gray-500">{sla.state === "missed" ? "dispatched late" : "dispatched"}</span>
                      )}
                      <span className="truncate text-gray-500">{t.assignee ? `👤 ${t.assignee}` : "unassigned"}</span>
                    </div>
                    {t.flags.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {t.flags.slice(0, 3).map((f) => (
                          <span key={f} className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: flagMeta(f)?.color, background: `${flagMeta(f)?.color}1f` }}>
                            {flagMeta(f)?.label ?? f}
                          </span>
                        ))}
                        {t.flags.length > 3 && <span className="text-[10px] text-gray-500">+{t.flags.length - 3}</span>}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Hero metrics */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricBlock icon={<Siren size={18} />} label="Incident" value={k.result ? k.result.incident_type.toUpperCase() : "—"} />
          <MetricBlock icon={<Timer size={18} />} label="Fastest ETA" value={fastest ? `~${fastest} min` : "—"} />
          <MetricBlock icon={<MapPinned size={18} />} label="Circle radius" value={k.pin ? `${k.pin.radius_m} m` : "—"} />
          <MetricBlock icon={<Truck size={18} />} label="Units found" value={k.units.length ? String(k.units.length) : "—"} />
        </div>

        {/* Map */}
        <Card
          title="Live location"
          action={
            k.result && (
              <div className="flex items-center gap-2">
                {k.result.low_confidence && <Badge color="#f59e0b">Low confidence</Badge>}
                <Badge color={sevColor}>Severity {k.result.severity}/5</Badge>
              </div>
            )
          }
          className="!p-3"
        >
          <div className="h-[440px] overflow-hidden rounded-xl">
            <MapView cands={k.cands} pin={k.pin} units={k.units} assigned={assigned} now={k.now} />
          </div>
          {k.result?.duplicate_of && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-risk-moderate/50 bg-white/60 px-3 py-2 text-sm">
              <span>
                ⚠ Possible duplicate of <b className="mono">{k.result.duplicate_of.id}</b> ({k.result.duplicate_of.distance_m} m away, {k.result.duplicate_of.minutes_ago} min ago)
              </span>
              <button
                type="button"
                onClick={() => {
                  const other = k.incidents.find((x) => x.id === k.result?.duplicate_of?.id);
                  if (other) k.openIncident(other);
                }}
                className="rounded-lg bg-white/80 px-2.5 py-1 text-xs font-semibold text-brand-from"
              >
                Open it
              </button>
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 px-1 text-[11px] text-gray-500">
            <Tag kind="MAP DATA" /> yellow dots <Tag kind="AI ESTIMATE" /> red pin and circle <Tag kind="COMPUTED" /> unit distances
          </div>
        </Card>

        {/* Tabs */}
        <div className="glass flex w-fit max-w-full gap-2 overflow-x-auto rounded-xl p-1.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`whitespace-nowrap rounded-lg px-4 py-1.5 text-sm transition-colors ${tab === t ? "bg-gradient-to-r from-brand-from to-brand-to text-white" : "text-gray-400 hover:text-sky-950"}`}
            >
              {t}
            </button>
          ))}
        </div>

        {tab === "Reasoning" && (
          <Card title="Reasoning trace">
            {k.trace.length === 0 ? (
              <p className="text-sm text-gray-500">Run a call to watch the locator think: landmarks, map lookups, rejected candidates.</p>
            ) : (
              <ul className="space-y-1.5 text-sm text-gray-300">
                {k.trace.map((t, i) => (
                  <li key={i} className={t.startsWith("MAP DATA") ? "mono text-xs text-amber-700" : t.startsWith("→") ? "text-teal-700" : ""}>
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}

        {tab === "Units" && (
          <Card title={`Nearest units · ${ROLES.find((r) => r.id === k.role)!.label} view`} action={<Tag kind="COMPUTED" />}>
            {units.length === 0 ? (
              <p className="text-sm text-gray-500">No units yet.</p>
            ) : (
              <ul className="space-y-2">
                {units.map((u, i) => (
                  <li key={i} className={`flex items-center justify-between gap-3 rounded-xl p-3 text-sm ${u.type === prefers ? "bg-white/70" : "bg-white/50"}`}>
                    <span>
                      {ICON[u.type]} {u.name}
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="mono whitespace-nowrap text-xs text-gray-400">
                        {(u.distance_m / 1000).toFixed(1)} km · ~{u.eta_min} min
                      </span>
                      {(() => {
                        const a = assigned.find((x) => x.name === u.name);
                        if (a) {
                          const done = progress(a, k.now) >= 1;
                          return <Badge color={done ? "#16a34a" : "#d97706"}>{done ? "Arrived" : `En route · ~${remainingMin(a, k.now)} min`}</Badge>;
                        }
                        return (
                          <button
                            type="button"
                            disabled={!k.activeId}
                            onClick={() => k.dispatchUnit(u)}
                            className="rounded-lg bg-gradient-to-r from-brand-from to-brand-to px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
                          >
                            Dispatch
                          </button>
                        );
                      })()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-gray-500">ETA = straight-line distance × 1.4 at an assumed average speed (fire 25 km/h, others 20 km/h), adjusted for current weather. Not live traffic. Unit movement on the map is SIMULATED at 8x speed.</p>
          </Card>
        )}

        {tab === "Dispatch card" && (
          <Card title="Dispatch card">
            {!k.dispatch || !k.result ? (
              <p className="text-sm text-gray-500">Waiting for a located incident.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="text-base">{k.dispatch.summary}</p>
                <p className="text-gray-300">{k.dispatch.dispatch_note}</p>
                <div>
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Needs</div>
                  <div className="flex gap-2">
                    {k.result.services.map((s) => (
                      <Badge key={s} color="#3b82f6">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                    SMS to caller <Tag kind="AI ESTIMATE" />
                  </div>
                  <p className="rounded-xl bg-white/50 p-3 italic">{k.dispatch.caller_sms}</p>
                  <button type="button" onClick={() => k.speak(k.dispatch!.caller_sms)} className="mt-2 flex items-center gap-1 text-xs text-brand-to hover:underline">
                    <Volume2 size={14} /> Read aloud
                  </button>
                </div>
              </div>
            )}
          </Card>
        )}

        {tab === "Grounding" && (
          <Card title="Grounding checks" action={<Tag kind="COMPUTED" />}>
            {!k.result || k.result.checks.length === 0 ? (
              <p className="text-sm text-gray-500">Every AI answer is validated against real map data and code before it is shown.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {k.result.checks.map((c, i) => (
                  <li key={i} className="flex items-center gap-2">
                    {c.pass ? <Check size={16} className="text-risk-low" /> : <X size={16} className="text-risk-severe" />}
                    <span className={c.pass ? "text-gray-300" : "text-risk-severe"}>{c.label}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-[11px] text-gray-500">The model proposes a pin. Code rejects it if it is outside Mumbai, unsupported by a real geocode result, or too far from evidence.</p>
          </Card>
        )}
      </div>

      {/* Caller panel */}
      <div className="lg:col-span-1">
        <div className="space-y-4 lg:sticky lg:top-20">
          <Card title="Incoming call">
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button key={p.label} onClick={() => k.setMessage(p.text)} className="glass rounded-lg px-2.5 py-1 text-xs text-gray-300 hover:text-sky-950">
                  {p.label}
                </button>
              ))}
            </div>
            <div className="relative">
              <textarea
                value={k.message}
                onChange={(e) => k.setMessage(e.target.value)}
                rows={4}
                placeholder="Caller ka message (Hinglish)…"
                className="field w-full resize-none rounded-xl p-3 pr-10 text-sm"
              />
              <button
                type="button"
                onClick={k.listen}
                title="Speak"
                className={`absolute right-2 top-2 rounded-lg p-1.5 ${k.listening ? "bg-risk-severe text-white" : "text-gray-400 hover:text-sky-950"}`}
              >
                <Mic size={16} />
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <button
                type="button"
                onClick={() => k.run()}
                disabled={k.busy || !k.message.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand-from to-brand-to py-2.5 font-semibold shadow-glow disabled:opacity-50"
              >
                {k.busy ? <Loader2 size={16} className="animate-spin" /> : <Siren size={16} />}
                {k.busy ? "Locating…" : "Kidhar?"}
              </button>
              <label className="flex items-center gap-1.5 text-xs text-gray-400">
                <input type="checkbox" checked={k.replay} onChange={(e) => k.setReplay(e.target.checked)} /> replay cached
              </label>
            </div>
            {k.error && <div className="mt-3 rounded-lg border border-risk-severe/50 p-2 text-xs text-risk-severe">{k.error}</div>}

            {k.phase !== "idle" && (
              <div className="mt-4 flex items-center gap-2 text-xs">
                {STEPS.map((s, i) => {
                  const done = k.phase === "done" || i < phaseIdx;
                  const active = i === phaseIdx;
                  return (
                    <span key={s.key} className={`flex items-center gap-1 ${done ? "text-risk-low" : active ? "text-brand-to" : "text-gray-600"}`}>
                      {done ? <Check size={12} /> : active ? <Loader2 size={12} className="animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />}
                      {s.label}
                    </span>
                  );
                })}
                {k.elapsed !== null && <span className="mono ml-auto text-risk-low">{k.elapsed}s</span>}
              </div>
            )}
          </Card>

          <TicketPanel />

          <WeatherCard pin={k.pin} incidentType={k.result?.incident_type} />

          <ForecastCard />

          {k.result && k.pin && (
            <Card title="Location confidence" action={<Tag kind="COMPUTED" />}>
              <div className="flex items-center gap-4">
                <Gauge value={confidence} color={confColor} label={`${Math.round(confidence * 100)}%`} sub={confidence > 0.8 ? "tight" : confidence > 0.5 ? "moderate" : "wide"} />
                <p className="text-xs text-gray-400">
                  Derived from the circle radius ({k.pin.radius_m} m). A tighter circle means more landmarks agreed.
                </p>
              </div>
            </Card>
          )}

          {k.result && (
            <Card title="Ask the caller">
              <ul className="space-y-2 text-sm">
                {k.result.follow_up_questions.map((q, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <button type="button" onClick={() => k.speak(q)} title="Read aloud" className="mt-0.5 text-brand-to">
                      <Volume2 size={14} />
                    </button>
                    <span>{q}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <input
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && replyText.trim() && !k.busy) {
                      k.reply(replyText);
                      setReplyText("");
                    }
                  }}
                  placeholder="Caller ka jawab…"
                  className="field flex-1 rounded-xl px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  disabled={k.busy || !replyText.trim()}
                  onClick={() => {
                    k.reply(replyText);
                    setReplyText("");
                  }}
                  className="rounded-xl bg-white/70 px-3 disabled:opacity-40"
                  aria-label="Send caller reply"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="mt-2 text-[11px] text-gray-500">The reply is added to the call and the location is re-estimated, so the circle can shrink.</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
