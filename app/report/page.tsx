"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2, LocateFixed, Mic, Siren } from "lucide-react";
import { Card } from "@/components/ui";
import { useKidhar, type Gps } from "@/components/KidharProvider";

export default function Report() {
  const k = useKidhar();
  const router = useRouter();
  const [gps, setGps] = useState<Gps | null>(null);
  const [gpsMsg, setGpsMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (submitted && k.phase === "done" && k.activeId) router.push(`/track/${k.activeId}`);
  }, [submitted, k.phase, k.activeId, router]);

  function locate() {
    if (!navigator.geolocation) {
      setGpsMsg("Location is not available on this device.");
      return;
    }
    setGpsMsg("Finding you…");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy_m: p.coords.accuracy });
        setGpsMsg(`Location shared (±${Math.round(p.coords.accuracy)} m)`);
      },
      () => setGpsMsg("Could not get your location. Describe where you are instead."),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  async function send() {
    setSubmitted(true);
    await k.run(k.message, { gps, source: "citizen" });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-5 py-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Need help?</h1>
        <p className="mt-1 text-sm text-gray-400">Tell us where you are in your own words. Landmarks are fine.</p>
      </div>

      <Card>
        <div className="relative">
          <textarea
            value={k.message}
            onChange={(e) => k.setMessage(e.target.value)}
            rows={5}
            maxLength={600}
            placeholder="e.g. Dadar station ke paas, Kirti College ke peeche, building mein aag lagi hai"
            className="field w-full resize-none rounded-xl p-3 pr-12 text-base"
          />
          <button
            type="button"
            onClick={k.listen}
            aria-label="Speak"
            className={`absolute right-2 top-2 rounded-full p-2.5 ${k.listening ? "bg-risk-severe text-white" : "bg-white/70 text-gray-300"}`}
          >
            <Mic size={18} />
          </button>
        </div>

        <button type="button" onClick={locate} className="glass mt-3 flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold">
          <LocateFixed size={16} className={gps ? "text-risk-low" : "text-brand-to"} />
          {gps ? "Location shared" : "Share my location (recommended)"}
        </button>
        {gpsMsg && <p className="mt-2 text-center text-xs text-gray-400">{gpsMsg}</p>}

        <button
          type="button"
          onClick={send}
          disabled={k.busy || !k.message.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-risk-severe to-risk-high py-4 text-lg font-bold text-white shadow-glow disabled:opacity-50"
        >
          {k.busy ? <Loader2 className="animate-spin" size={20} /> : <Siren size={20} />}
          {k.busy ? "Finding your location…" : "Get help"}
        </button>
        {k.error && <p className="mt-3 rounded-lg border border-risk-severe/50 p-2 text-sm text-risk-severe">{k.error}</p>}
      </Card>

      <p className="text-center text-[11px] text-gray-500">
        Prototype, not connected to 112. In a real emergency call 112 now. Your location is only used to find the nearest help.
      </p>
    </div>
  );
}
