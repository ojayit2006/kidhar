"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const SEVERITY_COLORS = ["#16a34a", "#16a34a", "#d97706", "#ea580c", "#dc2626", "#b91c1c"];

export function Card({ title, children, action, className = "" }: { title?: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={`glass rounded-2xl p-5 ${className}`}>
      {title && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">{title}</h3>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}

export function PulseDot({ color = "#22c55e" }: { color?: string }) {
  return <span className="pulse-dot" style={{ background: color, color }} />;
}

export function Badge({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span
      className="whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide"
      style={{ backgroundColor: `${color}22`, color, boxShadow: `0 0 12px ${color}33`, border: `1px solid ${color}55` }}
    >
      {children}
    </span>
  );
}

/** Provenance tag: every value on screen says where it came from. */
const TAGS = {
  FACT: "#1d4ed8",
  "MAP DATA": "#a16207",
  COMPUTED: "#0f766e",
  "AI ESTIMATE": "#c2410c",
  ASSUMPTION: "#6d28d9",
} as const;
export function Tag({ kind }: { kind: keyof typeof TAGS }) {
  return (
    <span className="mono rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: TAGS[kind], background: `${TAGS[kind]}1f`, border: `1px solid ${TAGS[kind]}44` }}>
      {kind}
    </span>
  );
}

export function Gauge({ value, color, label, sub }: { value: number; color: string; label: string; sub?: string }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, value));
  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle cx="72" cy="72" r={r} stroke="rgba(15,60,120,0.14)" strokeWidth="11" fill="none" />
        <motion.circle
          cx="72" cy="72" r={r} stroke={color} strokeWidth="11" fill="none" strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={{ duration: 1, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 8px ${color}88)` }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="mono text-2xl font-bold" style={{ color }}>{label}</span>
        {sub && <span className="mt-0.5 text-[10px] uppercase tracking-widest text-gray-400">{sub}</span>}
      </div>
    </div>
  );
}

export function MetricBlock({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="glass min-w-0 rounded-xl p-3">
      <div className="mb-2 text-brand-to">{icon}</div>
      <div className="mono truncate text-xl font-semibold text-gray-100">{value}</div>
      <div className="mt-1 text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
    </div>
  );
}
