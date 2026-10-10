"use client";

import { useState } from "react";
import { Phone } from "lucide-react";
import { Card } from "@/components/ui";
import SafetySteps from "@/components/SafetySteps";
import { useKidhar } from "@/components/KidharProvider";
import { t } from "@/lib/i18n";
import { HELPLINES, type SafetyType } from "@/lib/safety";

const GUIDES: SafetyType[] = ["fire", "medical", "accident", "crime"];

export default function Help() {
  const { lang: L } = useKidhar();
  const [guide, setGuide] = useState<SafetyType>("fire");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-5 py-8">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">{t(L, "help.title")}</h1>
        <p className="mt-1 text-sm text-gray-400">{t(L, "help.sub")}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {HELPLINES.map((h) => (
          <a key={h.number} href={`tel:${h.number}`} className="glass flex items-center justify-between gap-3 rounded-2xl p-4 transition hover:bg-white/80">
            <span className="text-sm font-semibold">{h.label[L]}</span>
            <span className="mono flex items-center gap-2 rounded-lg bg-gradient-to-r from-brand-from to-brand-to px-3 py-1.5 text-lg font-bold text-white">
              <Phone size={14} /> {h.number}
            </span>
          </a>
        ))}
      </div>

      <div>
        <h2 className="font-display mb-3 text-xl font-bold">{t(L, "help.guides")}</h2>
        <div className="glass mb-4 flex w-fit max-w-full gap-2 overflow-x-auto rounded-xl p-1.5">
          {GUIDES.map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setGuide(g)}
              className={`whitespace-nowrap rounded-lg px-4 py-1.5 text-sm transition-colors ${guide === g ? "bg-gradient-to-r from-brand-from to-brand-to text-white" : "text-gray-400 hover:text-sky-950"}`}
            >
              {t(L, `type.${g}`)}
            </button>
          ))}
        </div>
        <Card>
          <SafetySteps type={guide} bare />
        </Card>
      </div>
    </div>
  );
}
