"use client";

import dynamic from "next/dynamic";
import { use, useEffect, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import SafetySteps from "@/components/SafetySteps";
import { useKidhar } from "@/components/KidharProvider";
import { STATUS_COLOR, STATUS_LABEL, progress, remainingMin } from "@/lib/sim";
import { t } from "@/lib/i18n";
import { safetyType } from "@/lib/safety";
import type { Assigned, Status } from "@/lib/store";

const MapView = dynamic(() => import("@/components/MapView"), { ssr: false });

const STEPS: Status[] = ["new", "dispatched", "on_scene", "resolved"];

type Track = {
  id: string;
  status: Status;
  pin: { lat: number; lon: number; radius_m: number; low: boolean } | null;
  assigned: Assigned[];
  caller_sms: string | null;
  incident_type: string | null;
};

export default function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { lang: L, now } = useKidhar();
  const [track, setTrack] = useState<Track | null>(null);
  const [missing, setMissing] = useState(false);
  const [copied, setCopied] = useState(false);

  // Public, limited endpoint: only this incident's status, location and assigned units.
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch(`/api/track/${id}`, { cache: "no-store" });
        if (!alive) return;
        if (r.status === 404) return setMissing(true);
        const d = await r.json();
        if (d.track) setTrack(d.track);
      } catch {}
    };
    load();
    const timer = setInterval(load, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [id]);

  if (missing)
    return (
      <div className="mx-auto max-w-md px-5 py-10">
        <Card>
          <p className="text-sm text-gray-400">This report was not found.</p>
        </Card>
      </div>
    );
  if (!track)
    return (
      <div className="mx-auto max-w-md px-5 py-10">
        <Card>
          <p className="text-sm text-gray-400">…</p>
        </Card>
      </div>
    );

  const next = track.assigned.filter((a) => progress(a, now) < 1).sort((a, b) => remainingMin(a, now) - remainingMin(b, now))[0];
  const idx = STEPS.indexOf(track.status);
  const url = typeof window !== "undefined" ? `${window.location.origin}/track/${track.id}` : "";
  const where = track.pin ? ` https://www.openstreetmap.org/?mlat=${track.pin.lat}&mlon=${track.pin.lon}#map=17/${track.pin.lat}/${track.pin.lon}` : "";
  const shareText = `${t(L, "track.shareText")} ${url}${where ? `\n${where.trim()}` : ""}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-5 py-8">
      <div className="text-center">
        <p className="mono text-xs text-gray-500">{track.id}</p>
        <h1 className="font-display mt-1 text-3xl font-extrabold tracking-tight">
          {track.status === "dispatched" ? (next ? t(L, "track.dispatched", { n: remainingMin(next, now) }) : t(L, "track.dispatchedNoEta")) : t(L, `track.${track.status}`)}
        </h1>
        <div className="mt-2">
          <Badge color={STATUS_COLOR[track.status]}>{STATUS_LABEL[track.status]}</Badge>
        </div>
      </div>

      <div className="flex gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noreferrer"
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-bold text-white shadow-glow"
        >
          <Share2 size={16} /> {t(L, "track.share")}
        </a>
        <button type="button" onClick={copy} className="glass flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold">
          {copied ? <Check size={16} className="text-risk-low" /> : <Copy size={16} />}
          {copied ? t(L, "track.copied") : t(L, "track.copy")}
        </button>
      </div>

      <Card className="!p-3">
        <div className="h-[260px] overflow-hidden rounded-xl">
          <MapView cands={[]} pin={track.pin} units={[]} assigned={track.assigned} now={now} />
        </div>
        <p className="mt-2 px-1 text-[11px] text-gray-500">{t(L, "track.simulated")}</p>
      </Card>

      <Card title={t(L, "track.progress")}>
        <ol className="space-y-2 text-sm">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 ${i <= idx ? "text-gray-100" : "text-gray-600"}`}>
              {i <= idx ? <Check size={16} className="text-risk-low" /> : <span className="h-1.5 w-1.5 rounded-full bg-gray-600" />}
              {t(L, `track.s.${s}`)}
            </li>
          ))}
        </ol>
      </Card>

      {track.status !== "resolved" && <SafetySteps type={safetyType(track.incident_type)} />}

      {track.caller_sms && (
        <Card title={t(L, "track.msg")}>
          <p className="text-sm italic">{track.caller_sms}</p>
        </Card>
      )}

      <p className="text-center text-[11px] text-gray-500">{t(L, "report.disclaimer")}</p>
    </div>
  );
}
