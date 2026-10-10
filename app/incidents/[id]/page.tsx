"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { use } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import { Badge, Card, SEVERITY_COLORS, Tag } from "@/components/ui";
import { useKidhar } from "@/components/KidharProvider";
import { STATUS_COLOR, STATUS_LABEL, progress, remainingMin } from "@/lib/sim";
import { PRIORITY_COLOR, SLA_COLOR, flagMeta, fmtDuration, resolutionLabel, slaInfo, ticketOf } from "@/lib/ticket";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

export default function IncidentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { incidents, now } = useKidhar();
  const inc = incidents.find((i) => i.id === id);

  if (!inc) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/incidents" className="mb-4 inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sky-950">
          <ArrowLeft size={14} /> All incidents
        </Link>
        <Card>
          <p className="text-sm text-gray-400">Incident {id} was not found (it may still be loading).</p>
        </Card>
      </div>
    );
  }

  const r = inc.result;
  const pin = r ? { lat: r.pin.lat, lon: r.pin.lon, radius_m: r.radius_m, low: r.low_confidence } : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <Link href="/incidents" className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-sky-950">
        <ArrowLeft size={14} /> All incidents
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-3xl font-bold tracking-tight">{inc.id}</h1>
        {r && (
          <Badge color={SEVERITY_COLORS[r.severity]}>
            {r.incident_type} · {r.severity}/5
          </Badge>
        )}
        <Badge color={STATUS_COLOR[inc.status]}>{STATUS_LABEL[inc.status]}</Badge>
        <span className="mono text-xs text-gray-500">
          {new Date(inc.createdAt).toLocaleString()} · {inc.source}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Location" className="!p-3 lg:col-span-2">
          <div className="h-[420px] overflow-hidden rounded-xl">
            <MapView cands={[]} pin={pin} units={inc.units} assigned={inc.assigned} now={now} />
          </div>
        </Card>

        <div className="space-y-6">
          <Card title="Caller message">
            <p className="text-sm italic text-gray-300">{inc.message}</p>
            {inc.gps && (
              <p className="mono mt-2 text-[11px] text-gray-500">
                Device GPS {inc.gps.lat.toFixed(4)}, {inc.gps.lon.toFixed(4)} (±{Math.round(inc.gps.accuracy_m)} m)
              </p>
            )}
          </Card>
          <Card title="Dispatch card" action={<Tag kind="AI ESTIMATE" />}>
            {inc.dispatch ? (
              <div className="space-y-2 text-sm">
                <p>{inc.dispatch.summary}</p>
                <p className="text-gray-300">{inc.dispatch.dispatch_note}</p>
                <p className="rounded-xl bg-white/50 p-3 italic">{inc.dispatch.caller_sms}</p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No dispatch card.</p>
            )}
          </Card>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Units assigned" action={<Tag kind="COMPUTED" />}>
          {inc.assigned.length === 0 ? (
            <p className="text-sm text-gray-500">No units dispatched yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {inc.assigned.map((a) => {
                const done = progress(a, now) >= 1;
                return (
                  <li key={a.name} className="flex items-center justify-between rounded-xl bg-white/50 p-3">
                    <span>{a.name}</span>
                    <Badge color={done ? "#16a34a" : "#d97706"}>{done ? "Arrived" : `En route · ~${remainingMin(a, now)} min`}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-gray-500">Unit movement is SIMULATED at 8x speed.</p>
        </Card>

        <Card title="Grounding checks" action={<Tag kind="COMPUTED" />}>
          <ul className="space-y-2 text-sm">
            {(r?.checks ?? []).map((c: { label: string; pass: boolean }, i: number) => (
              <li key={i} className="flex items-center gap-2">
                {c.pass ? <Check size={16} className="text-risk-low" /> : <X size={16} className="text-risk-severe" />}
                <span className={c.pass ? "text-gray-300" : "text-risk-severe"}>{c.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {ticketSummary()}
    </div>
  );

  function ticketSummary() {
    const t = ticketOf(inc!);
    const sla = slaInfo(inc!, now || Date.now());
    return (
      <Card title="Ticket" action={<Badge color={PRIORITY_COLOR[t.priority]}>P{t.priority}</Badge>}>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3 text-sm">
            <p>
              Owner: <b>{t.assignee ?? "unassigned"}</b>
            </p>
            <p>
              Response target:{" "}
              <b style={{ color: SLA_COLOR[sla.state] }}>
                {sla.state === "met" ? `met (${fmtDuration(sla.elapsedMs)})` : sla.state === "missed" ? `missed (${fmtDuration(sla.elapsedMs)})` : sla.state === "breached" ? "overdue" : sla.state === "closed" ? "n/a" : "running"}
              </b>
            </p>
            {t.resolution && (
              <p>
                Outcome: <b>{resolutionLabel(t.resolution.code)}</b>
                {t.resolution.note ? `. ${t.resolution.note}` : ""} <span className="text-gray-500">({t.resolution.by})</span>
              </p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {t.flags.length === 0 && <span className="text-xs text-gray-500">No flags</span>}
              {t.flags.map((f) => (
                <span key={f} className="rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ color: flagMeta(f)?.color, background: `${flagMeta(f)?.color}1f`, border: `1px solid ${flagMeta(f)?.color}55` }}>
                  {flagMeta(f)?.label ?? f}
                </span>
              ))}
            </div>
          </div>
          <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
            {[...t.notes].reverse().map((n, i) => (
              <li key={i} className={`rounded-lg px-3 py-2 text-xs ${n.kind === "note" ? "bg-white/80" : "bg-white/40 text-gray-400"}`}>
                <span className="mono mr-2 text-[10px] text-gray-500">{new Date(n.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                {n.kind === "note" && <b className="mr-1">{n.by}:</b>}
                {n.text}
              </li>
            ))}
          </ul>
        </div>
      </Card>
    );
  }
}
