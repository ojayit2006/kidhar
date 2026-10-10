import { Brain, Calculator, FileText, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";

const STEPS = [
  { icon: Brain, who: "Claude Opus 5.5", title: "Locate", body: "Reads the Hinglish call, pulls out every landmark and relation (peeche, saamne, ke paas), looks them up on OpenStreetMap, rejects bad candidates and commits to a pin with an honest radius." },
  { icon: ShieldCheck, who: "Code", title: "Validate", body: "The pin must be inside Mumbai, backed by real geocode results and close to real evidence. If not, the circle is widened and flagged low confidence. The model never gets to invent coordinates." },
  { icon: Calculator, who: "Code", title: "Compute", body: "Nearest fire, police and hospital units, distances and ETAs come from plain deterministic code over a saved OpenStreetMap extract. No LLM arithmetic." },
  { icon: FileText, who: "Claude Sonnet 5.5", title: "Explain", body: "Writes the dispatch card and a calm SMS to the caller in English, Hindi or Marathi, using only the facts above." },
];

export default function How() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-6 py-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">How Kidhar? works</h1>
        <p className="mono mt-1 text-xs text-gray-500">AI LOCATES • CODE COMPUTES • YOU DECIDE</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {STEPS.map(({ icon: Icon, who, title, body }, i) => (
          <Card key={title}>
            <div className="mb-2 flex items-center gap-2 text-brand-to">
              <Icon size={18} />
              <span className="mono text-xs">0{i + 1} · {who}</span>
            </div>
            <h3 className="font-display mb-1 text-xl font-semibold">{title}</h3>
            <p className="text-sm text-gray-400">{body}</p>
          </Card>
        ))}
      </div>

      <Card title="Every value says where it came from">
        <ul className="space-y-1.5 text-sm text-gray-300">
          <li><b className="text-amber-700">MAP DATA</b>: a coordinate returned by the OpenStreetMap geocoder.</li>
          <li><b className="text-orange-600">AI ESTIMATE</b>: the pin, circle, severity and SMS wording proposed by the model.</li>
          <li><b className="text-teal-700">COMPUTED</b>: distances, ETAs and confidence derived by code.</li>
        </ul>
      </Card>

      <Card title="Limits">
        <p className="text-sm text-gray-400">
          Prototype on OpenStreetMap data. Landmark coverage is incomplete, ETAs use straight-line distance × 1.4 at an assumed speed, not live traffic. It is not connected to 112 or any real control room, and
          it supports a human dispatcher, it does not replace one.
        </p>
      </Card>
    </div>
  );
}
