"use client";

import "leaflet/dist/leaflet.css";
import { Circle, CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";

export type Incident = {
  message: string;
  incident_type: string;
  severity: number;
  services: string[];
  pin: { lat: number; lon: number };
  radius_m: number;
  low_confidence: boolean;
  summary: string;
  fastest_eta_min: number;
};

const SEV = ["#22c55e", "#22c55e", "#f59e0b", "#f97316", "#ef4444", "#b91c1c"];

export default function IncidentMap({ incidents }: { incidents: Incident[] }) {
  return (
    <MapContainer center={[19.05, 72.86]} zoom={11} className="h-full w-full" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {incidents.map((i, n) => (
        <span key={n}>
          {/* hotspot glow: radius scales with severity, not with uncertainty */}
          <Circle center={[i.pin.lat, i.pin.lon]} radius={600 + i.severity * 300} pathOptions={{ color: SEV[i.severity], fillColor: SEV[i.severity], fillOpacity: 0.18, weight: 0 }} />
          <CircleMarker center={[i.pin.lat, i.pin.lon]} radius={8} pathOptions={{ color: "#fff", fillColor: SEV[i.severity], fillOpacity: 1, weight: 2 }}>
            <Popup>
              {i.incident_type.toUpperCase()} · severity {i.severity}/5 · ±{i.radius_m} m
            </Popup>
          </CircleMarker>
        </span>
      ))}
    </MapContainer>
  );
}
