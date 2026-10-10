"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, TrendingUp } from "lucide-react";
import { Badge, Card, Tag } from "./ui";
import type { Cat, Forecast, Level } from "@/lib/forecast";

const LABEL: Record<Cat, string> = { accident: "Road accidents", medical: "Medical", fire: "Fire", crime: "Crime and threats", waterlogging: "Waterlogging" };
const COLOR: Record<Level, string> = { normal: "#16a34a", elevated: "#d97706", high: "#ea580c", severe: "#dc2626" };
const RANK: Record<Level, number> = { normal: 0, elevated: 1, high: 2, severe: 3 };

/** Compact look-ahead for the control room: highest relative risks over the next 6 hours. */
export default function ForecastCard() {
  const [f, setF] = useState<Forecast | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/forecast")
        .then((r) => r.json())
        .then((d) => alive && d.forecast && setF(d.forecast))
        .catch(() => {});
    load();
    const t = setInterval(load, 10 * 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const top = f
    ? (Object.keys(f.next6) as Cat[])
        .map((c) => ({ c, ...f.next6[c] }))
        .sort((a, b) => RANK[b.level] - RANK[a.level] || b.max - a.max)
        .slice(0, 3)
    : [];

  return (
    <Card title="Outlook · next 6 hours" action={<Tag kind="COMPUTED" />}>
      {!f ? (
        <p className="text-sm text-gray-500">Loading outlook…</p>
      ) : (
        <div className="space-y-2.5">
          {top.map((t) => (
            <div key={t.c} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2">
                <TrendingUp size={14} style={{ color: COLOR[t.level] }} />
                {LABEL[t.c]}
              </span>
              <span className="flex items-center gap-2">
                <span className="mono text-xs text-gray-400">×{t.max.toFixed(1)}</span>
                <Badge color={COLOR[t.level]}>{t.level}</Badge>
              </span>
            </div>
          ))}
          <p className="text-[11px] text-gray-500">Relative risk, not a forecast of specific events. {f.history.total < 20 ? "Leans on assumed patterns until more history is recorded." : ""}</p>
          <Link href="/forecast" className="flex items-center gap-1 text-xs font-semibold text-brand-from hover:underline">
            Full outlook <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </Card>
  );
}
