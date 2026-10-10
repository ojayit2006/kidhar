"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Ambulance, Building2, Flame, LocateFixed, Navigation, Phone, Shield } from "lucide-react";
import { Card } from "@/components/ui";
import { useKidhar } from "@/components/KidharProvider";
import { t } from "@/lib/i18n";
import type { UnitOut } from "@/components/MapView";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const DEMO = { lat: 19.0214, lon: 72.8311 };
const GROUPS = [
  { type: "hospital" as const, key: "type.hospital", icon: Ambulance },
  { type: "police" as const, key: "type.police", icon: Shield },
  { type: "fire" as const, key: "type.fireStation", icon: Flame },
];

export default function Nearby() {
  const { lang: L } = useKidhar();
  const [me, setMe] = useState<{ lat: number; lon: number } | null>(null);
  const [units, setUnits] = useState<UnitOut[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(p: { lat: number; lon: number }) {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch(`/api/nearby?lat=${p.lat}&lon=${p.lon}`);
      const d = await r.json();
      if (!r.ok) {
        setUnits([]);
        setMsg(r.status === 400 && String(d.error).includes("Mumbai") ? t(L, "nearby.mumbaiOnly") : d.error);
      } else {
        setMe(p);
        setUnits(d.units);
      }
    } catch {
      setMsg("Could not load nearby help.");
    }
    setBusy(false);
  }

  function useMine() {
    if (!navigator.geolocation) return setMsg(t(L, "nearby.denied"));
    setMsg(t(L, "nearby.finding"));
    navigator.geolocation.getCurrentPosition(
      (p) => search({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setMsg(t(L, "nearby.denied")),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-5 py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t(L, "nearby.title")}</h1>
        <p className="mt-1 text-sm text-gray-400">{t(L, "nearby.sub")}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={useMine} disabled={busy} className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-from to-brand-to px-4 py-2.5 text-sm font-semibold text-white shadow-glow disabled:opacity-50">
          <LocateFixed size={16} /> {t(L, "nearby.use")}
        </button>
        <button type="button" onClick={() => search(DEMO)} disabled={busy} className="glass rounded-xl px-4 py-2.5 text-sm font-semibold">
          {t(L, "nearby.demo")}
        </button>
        <a href="tel:112" className="flex items-center gap-2 rounded-xl bg-risk-severe px-4 py-2.5 text-sm font-bold text-white">
          <Phone size={16} /> {t(L, "nearby.call")}
        </a>
      </div>
      {msg && <p className="text-sm text-gray-400">{msg}</p>}

      {units.length > 0 && me && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card className="!p-3">
            <div className="h-[420px] overflow-hidden rounded-xl">
              <MapView cands={[]} pin={{ lat: me.lat, lon: me.lon, radius_m: 60, low: false }} units={units} />
            </div>
          </Card>
          <div className="space-y-4">
            {GROUPS.map(({ type, key, icon: Icon }) => (
              <Card key={type} title={t(L, key)} action={<Icon size={18} className="text-brand-to" />}>
                <ul className="space-y-2">
                  {units
                    .filter((u) => u.type === type)
                    .map((u) => (
                      <li key={u.name + u.lat} className="flex items-center justify-between gap-3 rounded-xl bg-white/50 p-3 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate font-semibold">{u.name}</span>
                          <span className="mono text-xs text-gray-500">{(u.distance_m / 1000).toFixed(1)} km</span>
                        </span>
                        <a
                          href={`https://www.google.com/maps/dir/?api=1&origin=${me.lat},${me.lon}&destination=${u.lat},${u.lon}`}
                          target="_blank"
                          rel="noreferrer"
                          className="flex shrink-0 items-center gap-1 rounded-lg bg-white/80 px-2.5 py-1.5 text-xs font-semibold text-brand-from"
                        >
                          <Navigation size={12} /> {t(L, "nearby.directions")}
                        </a>
                      </li>
                    ))}
                </ul>
              </Card>
            ))}
            <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
              <Building2 size={12} /> OpenStreetMap data, may be incomplete. In an emergency call 112.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
