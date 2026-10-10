"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { HeartPulse, Loader2, LocateFixed, MapPinned, Mic, Phone, Siren } from "lucide-react";
import { Card } from "@/components/ui";
import WeatherCard from "@/components/WeatherCard";
import { useKidhar, type Gps } from "@/components/KidharProvider";
import { t } from "@/lib/i18n";

const QUICK = ["fire", "medical", "accident", "crime", "flood"] as const;
const MED_KEY = "kidhar.medical";

type Med = { name: string; blood: string; allergies: string; conditions: string; share: boolean };
const EMPTY_MED: Med = { name: "", blood: "", allergies: "", conditions: "", share: false };

function loadMed(): Med {
  try {
    return { ...EMPTY_MED, ...JSON.parse(localStorage.getItem(MED_KEY) ?? "{}") };
  } catch {
    return EMPTY_MED;
  }
}

export default function Report() {
  const k = useKidhar();
  const router = useRouter();
  const [gps, setGps] = useState<Gps | null>(null);
  const [gpsMsg, setGpsMsg] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [med, setMed] = useState<Med>(EMPTY_MED);
  const [medOpen, setMedOpen] = useState(false);
  const L = k.lang;

  useEffect(() => {
    setMed(loadMed());
  }, []);

  useEffect(() => {
    if (submitted && k.phase === "done" && k.activeId) router.push(`/track/${k.activeId}`);
  }, [submitted, k.phase, k.activeId, router]);

  function updateMed(patch: Partial<Med>) {
    const next = { ...med, ...patch };
    setMed(next);
    try {
      localStorage.setItem(MED_KEY, JSON.stringify(next));
    } catch {}
  }

  function locate() {
    if (!navigator.geolocation) return setGpsMsg(t(L, "nearby.denied"));
    setGpsMsg(t(L, "report.finding"));
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setGps({ lat: p.coords.latitude, lon: p.coords.longitude, accuracy_m: p.coords.accuracy });
        setGpsMsg(`${t(L, "report.locShared")} (±${Math.round(p.coords.accuracy)} m)`);
      },
      () => setGpsMsg(t(L, "nearby.denied")),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function medLine() {
    if (!med.share) return "";
    const parts = [
      med.name && `Name ${med.name}`,
      med.blood && `Blood group ${med.blood}`,
      med.allergies && `Allergies ${med.allergies}`,
      med.conditions && `Conditions ${med.conditions}`,
    ].filter(Boolean);
    return parts.length ? `\n[Caller medical info, shared voluntarily: ${parts.join("; ")}]`.slice(0, 180) : "";
  }

  async function send() {
    setSubmitted(true);
    await k.run(`${k.message.trim()}${medLine()}`, { gps, source: "citizen" });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 px-5 py-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t(L, "report.title")}</h1>
        <p className="mt-1 text-sm text-gray-400">{t(L, "report.sub")}</p>
      </div>

      <Card>
        <div className="mb-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t(L, "report.quick")}</div>
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => k.setMessage(t(L, `prefix.${q}`))}
                className="glass rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-white/80"
              >
                {t(L, `type.${q}`)}
              </button>
            ))}
          </div>
        </div>

        <div className="relative">
          <textarea
            value={k.message}
            onChange={(e) => k.setMessage(e.target.value)}
            rows={5}
            maxLength={420}
            placeholder={t(L, "report.placeholder")}
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
          {gps ? t(L, "report.locShared") : t(L, "report.shareLoc")}
        </button>
        {gpsMsg && <p className="mt-2 text-center text-xs text-gray-400">{gpsMsg}</p>}

        <div className="mt-3 rounded-xl bg-white/50 p-3">
          <button type="button" onClick={() => setMedOpen(!medOpen)} className="flex w-full items-center justify-between text-sm font-semibold">
            <span className="flex items-center gap-2">
              <HeartPulse size={16} className="text-risk-severe" /> {t(L, "med.title")}
            </span>
            <span className="text-xs text-gray-500">{medOpen ? "−" : "+"}</span>
          </button>
          {medOpen && (
            <div className="mt-3 space-y-2">
              <p className="text-[11px] text-gray-500">{t(L, "med.hint")}</p>
              {(["name", "blood", "allergies", "conditions"] as const).map((f) => (
                <input
                  key={f}
                  value={med[f]}
                  onChange={(e) => updateMed({ [f]: e.target.value })}
                  placeholder={t(L, `med.${f}`)}
                  maxLength={40}
                  className="field w-full rounded-lg px-3 py-2 text-sm"
                />
              ))}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={med.share} onChange={(e) => updateMed({ share: e.target.checked })} />
                {t(L, "med.share")}
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={send}
          disabled={k.busy || !k.message.trim()}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-risk-severe to-risk-high py-4 text-lg font-bold text-white shadow-glow disabled:opacity-50"
        >
          {k.busy ? <Loader2 className="animate-spin" size={20} /> : <Siren size={20} />}
          {k.busy ? t(L, "report.finding2") : t(L, "report.getHelp")}
        </button>
        {k.error && <p className="mt-3 rounded-lg border border-risk-severe/50 p-2 text-sm text-risk-severe">{k.error}</p>}
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/nearby" className="glass flex items-center gap-2 rounded-xl p-3 text-sm font-semibold hover:bg-white/80">
          <MapPinned size={18} className="text-brand-to" /> {t(L, "report.nearby")}
        </Link>
        <Link href="/help" className="glass flex items-center gap-2 rounded-xl p-3 text-sm font-semibold hover:bg-white/80">
          <Phone size={18} className="text-brand-to" /> {t(L, "report.helplines")}
        </Link>
      </div>

      <WeatherCard pin={gps} />

      <p className="text-center text-[11px] text-gray-500">{t(L, "report.disclaimer")}</p>
    </div>
  );
}
