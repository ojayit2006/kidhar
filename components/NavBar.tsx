"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Siren, LayoutDashboard, History, BookOpen, WifiOff, Lock, MapPinned, LifeBuoy } from "lucide-react";
import { LANGS, ROLES, useKidhar } from "./KidharProvider";
import { PulseDot } from "./ui";

const LINKS = [
  { href: "/dispatch", label: "Dispatch", icon: LayoutDashboard },
  { href: "/report", label: "Report", icon: Siren },
  { href: "/nearby", label: "Nearby", icon: MapPinned },
  { href: "/help", label: "Help", icon: LifeBuoy },
  { href: "/incidents", label: "Incidents", icon: History },
  { href: "/admin", label: "Admin", icon: Lock },
  { href: "/how", label: "How it works", icon: BookOpen },
];

export default function NavBar() {
  const pathname = usePathname();
  const { role, lang, setLang, offline } = useKidhar();
  const roleLabel = ROLES.find((r) => r.id === role)!.label;

  return (
    <>
      {offline && (
        <div className="relative z-50 bg-risk-moderate/90 px-4 py-1.5 text-center text-xs font-semibold text-black">
          <WifiOff size={12} className="mr-1 inline" /> Offline: tick &quot;replay cached&quot; to run saved incidents
        </div>
      )}
      <nav className="glass sticky top-0 z-50 border-b border-white/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <Link href="/" className="font-display flex items-center gap-2 text-lg font-bold tracking-tight">
            <Siren size={20} className="text-brand-to" />
            Kidhar?
          </Link>
          <div className="flex items-center gap-1 overflow-x-auto">
            {LINKS.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition-colors ${pathname === href ? "bg-white/70 text-sky-950" : "text-gray-400 hover:text-sky-950"}`}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <Link href="/" className="hidden hover:text-sky-950 sm:inline" title="Change role">
              {roleLabel}
            </Link>
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value as typeof lang)}
              className="field rounded-md px-2 py-1 text-xs text-gray-200"
              aria-label="Language"
            >
              {LANGS.map((l) => (
                <option key={l.id} value={l.id} className="bg-white text-slate-900">
                  {l.label}
                </option>
              ))}
            </select>
            <span className="flex items-center gap-2">
              <PulseDot color={offline ? "#f59e0b" : "#22c55e"} />
              {offline ? "Offline" : "Live"}
            </span>
          </div>
        </div>
      </nav>
    </>
  );
}
