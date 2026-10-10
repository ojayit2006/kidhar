"use client";

import dynamic from "next/dynamic";
import { use } from "react";
import { Check } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { useKidhar } from "@/components/KidharProvider";
import { STATUS_COLOR, STATUS_LABEL, progress, remainingMin } from "@/lib/sim";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const STEPS = [
  { key: "new", label: "Report received" },
  { key: "dispatched", label: "Help dispatched" },
  { key: "on_scene", label: "Help has arrived" },
  { key: "resolved", label: "Resolved" },
] as const;

export default function Track({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { incidents, now } = useKidhar();
  const inc = incidents.find((i) => i.id === id);

  if (!inc) {
    return (
      <div className="mx-auto max-w-md px-5 py-10">
        <Card>
          <p className="text-sm text-gray-400">Looking for your report…</p>
        </Card>
      </div>
    );
  }

  const r = inc.result;
  const pin = r ? { lat: r.pin.lat, lon: r.pin.lon, radius_m: r.radius_m, low: r.low_confidence } : null;
  const next = inc.assigned.filter((a) => progress(a, now) < 1).sort((a, b) => remainingMin(a, now) - remainingMin(b, now))[0];
  const idx = STEPS.findIndex((s) => s.key === inc.status);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-5 py-8">
      <div className="text-center">
        <p className="mono text-xs text-gray-500">{inc.id}</p>
        <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight">
          {inc.status === "new" && "Your report is with the control room"}
          {inc.status === "dispatched" && (next ? `Help is ~${remainingMin(next, now)} min away` : "Help is on the way")}
          {inc.status === "on_scene" && "Help has arrived"}
          {inc.status === "resolved" && "This incident is resolved"}
        </h1>
        <div className="mt-2">
          <Badge color={STATUS_COLOR[inc.status]}>{STATUS_LABEL[inc.status]}</Badge>
        </div>
      </div>

      <Card className="!p-3">
        <div className="h-[260px] overflow-hidden rounded-xl">
          <MapView cands={[]} pin={pin} units={[]} assigned={inc.assigned} now={now} />
        </div>
        <p className="mt-2 px-1 text-[11px] text-gray-500">Unit movement is SIMULATED in this prototype.</p>
      </Card>

      <Card title="Progress">
        <ol className="space-y-2 text-sm">
          {STEPS.map((s, i) => (
            <li key={s.key} className={`flex items-center gap-2 ${i <= idx ? "text-gray-100" : "text-gray-600"}`}>
              {i <= idx ? <Check size={16} className="text-risk-low" /> : <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />}
              {s.label}
            </li>
          ))}
        </ol>
      </Card>

      {inc.dispatch?.caller_sms && (
        <Card title="Message for you">
          <p className="text-sm italic">{inc.dispatch.caller_sms}</p>
        </Card>
      )}

      <p className="text-center text-[11px] text-gray-500">Prototype, not connected to 112. In a real emergency call 112.</p>
    </div>
  );
}
