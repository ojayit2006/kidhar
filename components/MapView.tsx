"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, Circle, useMap } from "react-leaflet";
import { useEffect, useRef } from "react";
import type { Assigned } from "@/lib/store";
import { lerpPoint, progress } from "@/lib/sim";

export type Cand = { name: string; lat: number; lon: number };
export type UnitOut = { type: "police" | "fire" | "hospital"; name: string; lat: number; lon: number; distance_m: number; eta_min: number };
export type Pin = { lat: number; lon: number; radius_m: number; low: boolean };

const COLORS = { fire: "#ff4d2e", police: "#3b82f6", hospital: "#22c55e" } as const;

function Fit({ pin, cands }: { pin: Pin | null; cands: Cand[] }) {
  const map = useMap();
  // Depend on the pin's values, not the object: callers often rebuild it on every render (for example the live clock
  // tick), which would restart the fly-to animation every half second so the map never settled on the incident.
  const lat = pin?.lat;
  const lon = pin?.lon;
  const radius = pin?.radius_m ?? 0;
  const firstCand = cands[0];
  const first = useRef(true);
  useEffect(() => {
    const animate = !first.current; // the first view opens already in place; only later changes fly
    first.current = false;
    if (lat != null && lon != null) {
      const zoom = radius > 1000 ? 14 : 15;
      if (animate) map.flyTo([lat, lon], zoom, { duration: 1 });
      else map.setView([lat, lon], zoom, { animate: false });
    } else if (firstCand) {
      if (animate) map.flyTo([firstCand.lat, firstCand.lon], 15, { duration: 0.8 });
      else map.setView([firstCand.lat, firstCand.lon], 15, { animate: false });
    }
  }, [lat, lon, radius, firstCand?.lat, firstCand?.lon, map]);
  return null;
}

export default function MapView({ cands, pin, units, assigned = [], now = 0 }: { cands: Cand[]; pin: Pin | null; units: UnitOut[]; assigned?: Assigned[]; now?: number }) {
  return (
    <MapContainer center={pin ? [pin.lat, pin.lon] : [19.076, 72.8777]} zoom={pin ? (pin.radius_m > 1000 ? 14 : 15) : 12} className="h-full w-full" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <Fit pin={pin} cands={cands} />
      {cands.map((c, i) => (
        <CircleMarker key={`c${i}`} center={[c.lat, c.lon]} radius={6} pathOptions={{ color: "#111", fillColor: "#facc15", fillOpacity: 1, weight: 2 }}>
          <Popup>{c.name} (MAP DATA)</Popup>
        </CircleMarker>
      ))}
      {pin && (
        <>
          <Circle center={[pin.lat, pin.lon]} radius={pin.radius_m} pathOptions={{ color: pin.low ? "#f59e0b" : "#ef4444", fillOpacity: 0.15, dashArray: pin.low ? "6 6" : undefined }} />
          <CircleMarker center={[pin.lat, pin.lon]} radius={10} pathOptions={{ color: "#111", fillColor: "#ef4444", fillOpacity: 1, weight: 3 }}>
            <Popup>Incident estimate (AI ESTIMATE), radius {pin.radius_m} m</Popup>
          </CircleMarker>
        </>
      )}
      {pin &&
        units.map((u, i) => (
          <span key={`u${i}`}>
            <Polyline positions={[[pin.lat, pin.lon], [u.lat, u.lon]]} pathOptions={{ color: COLORS[u.type], weight: 2, dashArray: "4 6" }} />
            <CircleMarker center={[u.lat, u.lon]} radius={8} pathOptions={{ color: "#111", fillColor: COLORS[u.type], fillOpacity: 1, weight: 2 }}>
              <Popup>
                {u.name}: {(u.distance_m / 1000).toFixed(1)} km, ~{u.eta_min} min (COMPUTED)
              </Popup>
            </CircleMarker>
          </span>
        ))}
      {pin &&
        assigned.map((a) => {
          const t = now ? progress(a, now) : 0;
          const p = lerpPoint(a, pin, t);
          return (
            <span key={`a${a.name}`}>
              <Polyline positions={[[a.lat, a.lon], [pin.lat, pin.lon]]} pathOptions={{ color: COLORS[a.type], weight: 4 }} />
              <CircleMarker center={[p.lat, p.lon]} radius={11} pathOptions={{ color: "#fff", fillColor: COLORS[a.type], fillOpacity: 1, weight: 3 }}>
                <Popup>
                  {a.name}: {t >= 1 ? "arrived" : "en route"} (SIMULATED)
                </Popup>
              </CircleMarker>
            </span>
          );
        })}
    </MapContainer>
  );
}
