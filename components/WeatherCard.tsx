"use client";

import { useEffect, useState } from "react";
import { Droplets, Navigation, Thermometer, TriangleAlert, Wind } from "lucide-react";
import { Badge, Card, PulseDot, Tag } from "./ui";
import type { Weather, WeatherImpact } from "@/lib/weather";

const MUMBAI = { lat: 19.076, lon: 72.8777 };
const REFRESH_MS = 5 * 60_000;

/** Live weather at the incident pin, or citywide when nothing is selected. Refreshes every 5 minutes. */
export default function WeatherCard({ pin, incidentType }: { pin: { lat: number; lon: number } | null; incidentType?: string }) {
  const [data, setData] = useState<{ weather: Weather; impact: WeatherImpact } | null>(null);
  const [error, setError] = useState("");
  const lat = pin?.lat ?? MUMBAI.lat;
  const lon = pin?.lon ?? MUMBAI.lon;

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const q = new URLSearchParams({ lat: String(lat), lon: String(lon) });
        if (incidentType) q.set("type", incidentType);
        const r = await fetch(`/api/weather?${q}`, { cache: "no-store" });
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) return setError(d.error ?? "Weather unavailable");
        setError("");
        setData(d);
      } catch {
        if (alive) setError("Weather unavailable");
      }
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [lat, lon, incidentType]);

  const w = data?.weather;
  const impact = data?.impact;

  return (
    <Card
      title={pin ? "Weather at scene" : "Weather · Mumbai"}
      action={
        <span className="flex items-center gap-2">
          <PulseDot color={error ? "#d97706" : "#16a34a"} />
          <Tag kind="FACT" />
        </span>
      }
    >
      {!w ? (
        <p className="text-sm text-gray-500">{error || "Loading weather…"}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="mono text-4xl font-semibold leading-none">{Math.round(w.tempC)}°C</div>
              <div className="mt-1 text-sm text-gray-300">
                {w.label} · feels {Math.round(w.feelsC)}°C
              </div>
            </div>
            <div className="text-right text-[11px] text-gray-500">
              {w.source}
              <br />
              {w.observedAt.slice(11, 16)} IST
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-xl bg-white/50 p-2">
              <Wind size={14} className="mx-auto mb-1 text-brand-to" />
              <div className="mono font-semibold">{Math.round(w.windKmh)} km/h</div>
              <div className="flex items-center justify-center gap-1 text-[10px] text-gray-500">
                <Navigation size={10} style={{ transform: `rotate(${w.windFromDeg + 180 - 45}deg)` }} /> to {w.windToward}
              </div>
            </div>
            <div className="rounded-xl bg-white/50 p-2">
              <Droplets size={14} className="mx-auto mb-1 text-brand-to" />
              <div className="mono font-semibold">{w.humidity}%</div>
              <div className="text-[10px] text-gray-500">humidity</div>
            </div>
            <div className="rounded-xl bg-white/50 p-2">
              <Thermometer size={14} className="mx-auto mb-1 text-brand-to" />
              <div className="mono font-semibold">{w.precipMm} mm</div>
              <div className="text-[10px] text-gray-500">rain</div>
            </div>
          </div>

          {impact && (
            <div className="space-y-2 border-t border-white/50 pt-3">
              <div className="flex items-center gap-2">
                <Tag kind="COMPUTED" />
                <Badge color={impact.etaFactor > 1 ? "#d97706" : "#16a34a"}>{impact.etaFactor > 1 ? `ETA ×${impact.etaFactor}` : "No delay"}</Badge>
              </div>
              <p className="text-xs text-gray-400">{impact.etaReason}</p>
              <ul className="space-y-1.5 text-sm">
                {impact.notes.map((n, i) => (
                  <li key={i} className={`flex items-start gap-2 ${n.level === "warn" ? "text-risk-moderate" : "text-gray-300"}`}>
                    {n.level === "warn" && <TriangleAlert size={14} className="mt-0.5 shrink-0" />}
                    <span>{n.text}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
