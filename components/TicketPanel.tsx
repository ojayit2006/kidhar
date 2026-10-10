"use client";

import { useState } from "react";
import { ArrowUpCircle, Flag, StickyNote, UserCheck, X } from "lucide-react";
import { Badge, Card } from "./ui";
import { useKidhar } from "./KidharProvider";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/sim";
import { FLAGS, PRIORITY_COLOR, RESOLUTIONS, SLA_COLOR, SLA_MINUTES, fmtDuration, flagMeta, resolutionLabel, slaInfo, ticketOf, type Priority } from "@/lib/ticket";
import type { Status } from "@/lib/store";

const STATUSES: Status[] = ["new", "dispatched", "on_scene", "resolved"];

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export default function TicketPanel() {
  const k = useKidhar();
  const inc = k.activeIncident;
  const [note, setNote] = useState("");
  const [closing, setClosing] = useState(false);
  const [code, setCode] = useState<string>(RESOLUTIONS[0].id);
  const [closeNote, setCloseNote] = useState("");

  if (!inc) return null;
  const t = ticketOf(inc);
  const now = k.now;
  const sla = slaInfo(inc, now);
  const me = k.operator.trim();
  const mine = me !== "" && t.assignee === me;
  const free = FLAGS.filter((f) => !t.flags.includes(f.id));
  const slaText =
    sla.state === "met" ? `Dispatched in ${fmtDuration(sla.elapsedMs)}` :
    sla.state === "missed" ? `Dispatched late (${fmtDuration(sla.elapsedMs)}, target ${SLA_MINUTES[t.priority]}:00)` :
    sla.state === "closed" ? "No response timer" :
    sla.state === "breached" ? `Overdue by ${fmtDuration(sla.remainingMs)}` :
    `${fmtDuration(sla.remainingMs)} left to dispatch`;

  async function close() {
    const ok = await k.setStatus(inc!.id, "resolved", { code, note: closeNote });
    if (ok) {
      setClosing(false);
      setCloseNote("");
    }
  }

  return (
    <Card
      title={`Ticket · ${inc.id}`}
      action={
        <span className="flex items-center gap-2">
          {t.escalated && <Badge color="#dc2626">Escalated</Badge>}
          <Badge color={PRIORITY_COLOR[t.priority]}>P{t.priority}</Badge>
        </span>
      }
    >
      <div className="space-y-4 text-sm">
        {/* Operator */}
        <div className="flex items-center gap-2">
          <UserCheck size={15} className="text-brand-to" />
          <input
            value={k.operator}
            onChange={(e) => k.setOperator(e.target.value)}
            placeholder="Your name (shown on the ticket log)"
            maxLength={30}
            className="field flex-1 rounded-lg px-3 py-1.5 text-sm"
            aria-label="Operator name"
          />
        </div>

        {/* SLA and priority */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white/50 p-3">
          <span className="mono text-sm font-semibold" style={{ color: SLA_COLOR[sla.state] }}>
            {slaText}
          </span>
          <label className="flex items-center gap-1.5 text-xs text-gray-400">
            Priority
            <select
              value={t.priority}
              onChange={(e) => k.ticketOp(inc.id, { priority: Number(e.target.value) })}
              className="field rounded-md px-2 py-1 text-xs"
              aria-label="Priority"
            >
              {([1, 2, 3, 4] as Priority[]).map((p) => (
                <option key={p} value={p}>
                  P{p} · {SLA_MINUTES[p]} min target
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Owner */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-gray-300">
            Owner: <b>{t.assignee ?? "unassigned"}</b>
          </span>
          {mine ? (
            <button type="button" onClick={() => k.ticketOp(inc.id, { assignee: null })} className="glass rounded-lg px-3 py-1 text-xs font-semibold">
              Release
            </button>
          ) : (
            <button
              type="button"
              disabled={!me}
              title={me ? "" : "Enter your name first"}
              onClick={() => k.ticketOp(inc.id, { assignee: me })}
              className="rounded-lg bg-gradient-to-r from-brand-from to-brand-to px-3 py-1 text-xs font-semibold text-white disabled:opacity-40"
            >
              {t.assignee ? "Take over" : "Take ticket"}
            </button>
          )}
        </div>

        {/* Status */}
        <div>
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">Status</div>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => (s === "resolved" ? setClosing(true) : k.setStatus(inc.id, s))}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${inc.status === s ? "text-white" : "bg-white/60 text-gray-300 hover:bg-white/90"}`}
                style={inc.status === s ? { background: STATUS_COLOR[s] } : undefined}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          {closing && (
            <div className="mt-3 space-y-2 rounded-xl border border-white/70 bg-white/50 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Close ticket: choose an outcome</div>
              <select value={code} onChange={(e) => setCode(e.target.value)} className="field w-full rounded-lg px-3 py-2 text-sm" aria-label="Resolution">
                {RESOLUTIONS.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </select>
              <input value={closeNote} onChange={(e) => setCloseNote(e.target.value)} placeholder="Closing note (optional)" maxLength={300} className="field w-full rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <button type="button" onClick={close} className="rounded-lg bg-risk-low px-3 py-1.5 text-xs font-semibold text-white">
                  Close ticket
                </button>
                <button type="button" onClick={() => setClosing(false)} className="rounded-lg bg-white/70 px-3 py-1.5 text-xs">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {t.resolution && inc.status === "resolved" && (
            <p className="mt-2 text-xs text-gray-400">
              Closed by {t.resolution.by}: <b>{resolutionLabel(t.resolution.code)}</b>
              {t.resolution.note ? `. ${t.resolution.note}` : ""}
            </p>
          )}
        </div>

        {/* Flags */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <Flag size={12} /> Flags
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {t.flags.length === 0 && <span className="text-xs text-gray-500">None</span>}
            {t.flags.map((id) => {
              const m = flagMeta(id);
              return (
                <button
                  key={id}
                  type="button"
                  title={`${m?.hint ?? ""} (click to remove)`}
                  onClick={() => k.ticketOp(inc.id, { flag: { id, on: false } })}
                  className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                  style={{ color: m?.color, background: `${m?.color}1f`, border: `1px solid ${m?.color}55` }}
                >
                  {m?.label ?? id} <X size={10} />
                </button>
              );
            })}
            {free.length > 0 && (
              <select
                value=""
                onChange={(e) => e.target.value && k.ticketOp(inc.id, { flag: { id: e.target.value, on: true } })}
                className="field rounded-full px-2.5 py-1 text-[11px]"
                aria-label="Add flag"
              >
                <option value="">+ Add flag</option>
                {free.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Escalate */}
        <button
          type="button"
          disabled={t.escalated || inc.status === "resolved"}
          onClick={() => k.ticketOp(inc.id, { escalate: true })}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-white/60 py-2 text-xs font-semibold text-risk-severe hover:bg-white/90 disabled:opacity-40"
        >
          <ArrowUpCircle size={14} /> {t.escalated ? "Escalated to supervisor" : "Escalate to supervisor"}
        </button>

        {/* Notes and activity */}
        <div>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <StickyNote size={12} /> Notes and activity
          </div>
          <div className="flex gap-2">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && note.trim()) {
                  k.ticketOp(inc.id, { note });
                  setNote("");
                }
              }}
              placeholder="Add a note…"
              maxLength={500}
              className="field flex-1 rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              disabled={!note.trim()}
              onClick={() => {
                k.ticketOp(inc.id, { note });
                setNote("");
              }}
              className="rounded-lg bg-white/70 px-3 text-xs font-semibold disabled:opacity-40"
            >
              Add
            </button>
          </div>
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {[...t.notes].reverse().map((n, i) => (
              <li key={i} className={`rounded-lg px-3 py-2 text-xs ${n.kind === "note" ? "bg-white/80" : "bg-white/40 text-gray-400"}`}>
                <span className="mono mr-2 text-[10px] text-gray-500">{clock(n.at)}</span>
                {n.kind === "note" && <b className="mr-1">{n.by}:</b>}
                {n.kind === "system" && n.by !== "system" && <span className="mr-1 text-gray-500">{n.by}:</span>}
                {n.text}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
