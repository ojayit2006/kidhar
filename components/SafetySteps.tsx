"use client";

import { ShieldCheck, Volume2 } from "lucide-react";
import { useKidhar } from "./KidharProvider";
import { Card } from "./ui";
import { t } from "@/lib/i18n";
import { SAFETY, type SafetyType } from "@/lib/safety";

/** Static, curated first-response steps for the incident type, in the chosen language. */
export default function SafetySteps({ type, bare = false }: { type: SafetyType; bare?: boolean }) {
  const { lang, speak } = useKidhar();
  const steps = SAFETY[type][lang];

  const body = (
    <>
      <ol className="space-y-2.5 text-[15px]">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="mono mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/80 text-xs font-semibold text-brand-from">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex items-center justify-between gap-3">
        <button type="button" onClick={() => speak(steps.join(". "))} className="glass flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold">
          <Volume2 size={14} className="text-brand-to" /> {t(lang, "safety.read")}
        </button>
        <p className="text-right text-[11px] text-gray-500">{t(lang, "safety.disclaimer")}</p>
      </div>
    </>
  );

  if (bare) return body;
  return (
    <Card
      title={t(lang, "safety.title")}
      action={<ShieldCheck size={18} className="text-risk-low" />}
    >
      {body}
    </Card>
  );
}
