"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Siren, Flame, Shield, Ambulance, Radio, User } from "lucide-react";
import { LANGS, ROLES, useKidhar, type Role } from "@/components/KidharProvider";

const ICONS: Record<Role, typeof Flame> = { control: Radio, fire: Flame, police: Shield, ambulance: Ambulance, citizen: User };

export default function Landing() {
  const { role, setRole, lang, setLang } = useKidhar();
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center px-6 py-14">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-10 text-center">
        <div className="mb-4 flex items-center justify-center gap-2">
          <Siren className="text-brand-to" size={32} />
          <span className="font-display text-4xl font-extrabold tracking-tight">Kidhar?</span>
        </div>
        <p className="mx-auto max-w-md text-gray-400">
          In India we don&apos;t give addresses, we give landmarks. Kidhar? turns &quot;Kirti College ke peeche&quot; into a map pin and the nearest help.
        </p>
        <p className="mono mx-auto mt-4 text-xs text-gray-500">AI LOCATES • CODE COMPUTES • YOU DECIDE</p>
      </motion.div>

      <div className="w-full max-w-xl space-y-6">
        <div>
          <label className="mb-2 block text-xs uppercase tracking-wide text-gray-500">Who are you?</label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ROLES.map((r) => {
              const Icon = ICONS[r.id];
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setRole(r.id)}
                  className={`glass flex items-start gap-3 rounded-xl p-3 text-left transition ${active ? "!border-brand-from shadow-glow" : "hover:border-white"}`}
                >
                  <Icon size={20} className={active ? "text-brand-to" : "text-gray-400"} />
                  <span>
                    <span className="block text-sm font-semibold">{r.label}</span>
                    <span className="block text-xs text-gray-400">{r.blurb}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-wide text-gray-500">Caller language</label>
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLang(l.id)}
                className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${lang === l.id ? "bg-gradient-to-r from-brand-from to-brand-to text-white" : "glass text-gray-400 hover:text-sky-950"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>

        <motion.button
          type="button"
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/dispatch")}
          className="w-full rounded-xl bg-gradient-to-r from-brand-from to-brand-to py-3 font-semibold shadow-glow"
        >
          Enter dispatch console
        </motion.button>
      </div>

      <div className="mt-14 max-w-lg text-center text-xs text-gray-600">
        Build Day Mumbai • Claude Opus 5.5 plans, Sonnet 5.5 ships • Prototype on OpenStreetMap data, not connected to 112
      </div>
    </div>
  );
}
