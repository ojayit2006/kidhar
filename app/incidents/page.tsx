"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Flame, Gauge as GaugeIcon, Timer } from "lucide-react";
import { Badge, Card, MetricBlock, SEVERITY_COLORS } from "@/components/ui";
import { useKidhar } from "@/components/KidharProvider";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/sim";
import type { Incident as MapIncident } from "@/components/IncidentMap";

const IncidentMap = dynamic(() => import("@/components/IncidentMap"), { ssr: false });

export default function Incidents() {
  const { incidents } = useKidhar();
  const list = incidents.filter((i) => i.result);

  const mapItems: MapIncident[] = list.map((i) => ({
    message: i.message,
    incident_type: i.result.incident_type,
    severity: i.result.severity,
    services: i.result.services,
    pin: i.result.pin,
    radius_m: i.result.radius_m,
    low_confidence: i.result.low_confidence,
    summary: i.dispatch?.summary ?? "",
    fastest_eta_min: Math.min(...(i.units.length ? i.units.map((u: { eta_min: number }) => u.eta_min) : [0])),
  }));

  const avgSev = list.length ? (list.reduce((a, i) => a + i.result.severity, 0) / list.length).toFixed(1) : "—";
  const avgEta = mapItems.length ? `~${Math.round(mapItems.reduce((a, i) => a + i.fastest_eta_min, 0) / mapItems.length)} min` : "—";

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Incident log</h1>
        <p className="text-sm text-gray-400">Every call Kidhar? has located, with its status. Click one for the full record.</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricBlock icon={<Flame size={18} />} label="Incidents" value={String(list.length)} />
        <MetricBlock icon={<GaugeIcon size={18} />} label="Avg severity" value={avgSev} />
        <MetricBlock icon={<Timer size={18} />} label="Avg fastest ETA" value={avgEta} />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card title="Hotspots" className="!p-3 lg:col-span-3">
          <div className="h-[460px] overflow-hidden rounded-xl">
            <IncidentMap incidents={mapItems} />
          </div>
        </Card>

        <Card title="Recent calls" className="lg:col-span-2">
          {list.length === 0 ? (
            <p className="text-sm text-gray-500">No incidents yet. Run a call on the Dispatch page.</p>
          ) : (
            <ul className="space-y-3">
              {list.map((i) => (
                <li key={i.id}>
                  <Link href={`/incidents/${i.id}`} className="block rounded-xl bg-white/50 p-3 text-sm transition hover:bg-white/80">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <Badge color={SEVERITY_COLORS[i.result.severity]}>
                        {i.result.incident_type} · {i.result.severity}/5
                      </Badge>
                      <Badge color={STATUS_COLOR[i.status]}>{STATUS_LABEL[i.status]}</Badge>
                    </div>
                    <p className="text-gray-200">{i.dispatch?.summary || i.message}</p>
                    <p className="mono mt-1 text-[11px] text-gray-500">
                      {i.id} · ±{i.result.radius_m} m · {i.source}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
