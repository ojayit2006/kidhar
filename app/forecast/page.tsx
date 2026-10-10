"use client";

import { useCallback, useEffect, useState } from "react";
import { Car, CloudRain, Flame, HeartPulse, Info, Loader2, RefreshCw, ShieldAlert, Sparkles } from "lucide-react";
import { Badge, Card, PulseDot, Tag } from "@/components/ui";
import type { Cat, Forecast, Level } from "@/lib/forecast";

const CATS: Cat[] = ["accident", "medical", "fire", "crime", "waterlogging"];
const LABEL: Record<Cat, string> = { accident: "Road accidents", medical: "Medical", fire: "Fire", crime: "Crime and threats", waterlogging: "Waterlogging" };
const ICON = { accident: Car, medical: HeartPulse, fire: Flame, crime: ShieldAlert, waterlogging: CloudRain } as const;
const LEVEL_COLOR: Record<Level, string> = { normal: "#16a34a", elevated: "#d97706", high: "#ea580c", severe: "#dc2626" };

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;

export default function ForecastPage() {
  const [f, setF] = useState<Forecast | null>(null);
  const [briefing, setBriefing] = useState<string | null>(null);
  const [briefBusy, setBriefBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch("/api/forecast", { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) return setError(d.error ?? "Forecast unavailable");
      setF(d.forecast);
      setBriefBusy(true);
      fetch("/api/forecast?brief=1", { cache: "no-store" })
        .then((x) => x.json())
        .then((x) => setBriefing(x.briefing ?? null))
        .catch(() => {})
        .finally(() => setBriefBusy(false));
    } catch {
      setError("Forecast unavailable");
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  if (error && !f) return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-risk-severe">{error}</div>;
  if (!f) return <div className="mx-auto max-w-3xl px-6 py-10 text-sm text-gray-400">Building the outlook…</div>;

  const maxRain = Math.max(1, ...f.hours.map((h) => h.weather.precipMm));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight">Outlook · next 24 hours</h1>
          <p className="mt-1 flex items-center gap-2 text-sm text-gray-400">
            <PulseDot /> Relative risk for Mumbai. Updated {new Date(f.generatedAt).toLocaleTimeString()}.
          </p>
        </div>
        <button type="button" onClick={load} className="glass flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Briefing */}
      <Card title="Briefing" action={<Tag kind="AI ESTIMATE" />}>
        {briefing ? (
          <p className="whitespace-pre-line text-[15px] leading-relaxed">{briefing}</p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            {briefBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {briefBusy ? "Writing a short briefing from the numbers below…" : "Briefing unavailable. The numbers below are unaffected."}
          </p>
        )}
        <p className="mt-2 text-[11px] text-gray-500">Written by the AI from the computed figures only. It adds no information of its own.</p>
      </Card>

      {/* Next 6 hours */}
      <div>
        <h2 className="font-display mb-3 text-xl font-bold">Next 6 hours</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          {CATS.map((c) => {
            const n = f.next6[c];
            const Icon = ICON[c];
            return (
              <div key={c} className="glass rounded-2xl p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Icon size={18} style={{ color: LEVEL_COLOR[n.level] }} />
                  <Badge color={LEVEL_COLOR[n.level]}>{n.level}</Badge>
                </div>
                <div className="text-sm font-semibold">{LABEL[c]}</div>
                <div className="mono mt-1 text-2xl font-bold" style={{ color: LEVEL_COLOR[n.level] }}>
                  ×{n.max.toFixed(1)}
                </div>
                <div className="text-[11px] text-gray-500">{n.window ? `peak window ${n.window}` : "no elevated hours"}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Hourly strip */}
      <Card title="Hour by hour" action={<Tag kind="COMPUTED" />}>
        <div className="overflow-x-auto">
          <div className="min-w-[760px]">
            <div className="grid items-center gap-[3px]" style={{ gridTemplateColumns: `130px repeat(${f.hours.length}, minmax(0, 1fr))` }}>
              <div />
              {f.hours.map((h) => (
                <div key={h.time} className="mono text-center text-[10px] text-gray-500">
                  {h.hour % 3 === 0 ? String(h.hour).padStart(2, "0") : ""}
                </div>
              ))}
              {CATS.map((c) => (
                <div key={c} className="contents">
                  <div className="pr-2 text-xs font-semibold">{LABEL[c]}</div>
                  {f.hours.map((h) => {
                    const r = h.risk[c];
                    const tip = `${hh(h.hour)} · ${LABEL[c]} ×${r.index.toFixed(1)} (${r.level})${r.drivers.length ? `\n${r.drivers.join(", ")}` : ""}`;
                    return (
                      <div
                        key={h.time + c}
                        title={tip}
                        className="h-7 rounded-[5px]"
                        style={{ background: LEVEL_COLOR[r.level], opacity: r.level === "normal" ? 0.25 : r.level === "elevated" ? 0.55 : r.level === "high" ? 0.8 : 1 }}
                      />
                    );
                  })}
                </div>
              ))}
              <div className="pr-2 text-xs font-semibold text-gray-400">Rain (mm/h)</div>
              {f.hours.map((h) => (
                <div key={h.time + "rain"} title={`${hh(h.hour)} rain ${h.weather.precipMm.toFixed(1)} mm/h, ${h.weather.precipProb}% chance`} className="flex h-8 items-end">
                  <div className="w-full rounded-t-[3px] bg-brand-from/70" style={{ height: `${Math.max(2, (h.weather.precipMm / maxRain) * 100)}%` }} />
                </div>
              ))}
              <div className="pr-2 text-xs font-semibold text-gray-400">Feels like (°C)</div>
              {f.hours.map((h) => (
                <div key={h.time + "t"} className="mono text-center text-[10px] text-gray-400">
                  {h.hour % 3 === 0 ? Math.round(h.weather.feelsC) : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-gray-500">
          {(["normal", "elevated", "high", "severe"] as Level[]).map((l) => (
            <span key={l} className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: LEVEL_COLOR[l], opacity: l === "normal" ? 0.25 : l === "elevated" ? 0.55 : l === "high" ? 0.8 : 1 }} />
              {l}
            </span>
          ))}
          <span>Hover a cell for the reasons. 1.0× is a typical hour.</span>
        </div>
      </Card>

      {/* Recommendations */}
      <Card title="Readiness suggestions">
        <ul className="space-y-3">
          {f.recommendations.map((r, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <Badge color={LEVEL_COLOR[r.level]}>{r.level}</Badge>
              <span className="flex-1">{r.text}</span>
              <span className="flex shrink-0 gap-1">
                {r.basis.map((b) => (
                  <Tag key={b} kind={b === "weather" ? "FACT" : b === "history" ? "COMPUTED" : "ASSUMPTION"} />
                ))}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-gray-500">Rule-based suggestions for a human supervisor to weigh. Tags show what each is based on: weather forecast (FACT), assumed time pattern (ASSUMPTION), or your history (COMPUTED).</p>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="How much to trust this" action={<Info size={16} className="text-brand-to" />}>
          <ul className="space-y-2 text-sm text-gray-300">
            {f.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Card>

        <Card title="Learning from your history">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wide text-gray-500">
              <tr>
                <th className="py-1 text-left">Type</th>
                <th className="text-right">Incidents</th>
                <th className="text-right">History weight</th>
              </tr>
            </thead>
            <tbody>
              {CATS.filter((c) => c !== "waterlogging").map((c) => (
                <tr key={c} className="border-t border-white/50">
                  <td className="py-1.5">{LABEL[c]}</td>
                  <td className="mono text-right">{f.history.counts[c]}</td>
                  <td className="mono text-right">{Math.round(f.history.weights[c] * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[11px] text-gray-500">History weight is how much of the hourly pattern comes from recorded incidents instead of the assumed pattern. It grows with data and is capped at 70%.</p>
        </Card>
      </div>

      {f.hotspots.length > 0 && (
        <Card title="Where incidents have clustered" action={<Tag kind="COMPUTED" />}>
          <ul className="space-y-2 text-sm">
            {f.hotspots.map((h, i) => (
              <li key={i} className="flex items-center justify-between rounded-xl bg-white/50 p-3">
                <span className="mono text-xs">
                  {h.lat}, {h.lon}
                </span>
                <span className="text-gray-300">{h.types.join(", ")}</span>
                <span className="mono text-xs text-gray-500">score {h.score}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-gray-500">Past clustering within about 2 km cells, not a prediction of where the next incident will happen.</p>
        </Card>
      )}
    </div>
  );
}
