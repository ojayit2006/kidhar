import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs";
import path from "node:path";
import { geocode, matchesAnyCandidate, type Candidate } from "@/lib/geocode";
import { haversine, inMumbai, nearestUnits, type Unit } from "@/lib/geo";
import { createIncident } from "@/lib/store";
import { rateLimit } from "@/lib/ratelimit";

const MAX_MESSAGE_CHARS = 600;

export const maxDuration = 120;

const OPUS = "claude-opus-5-5";
const SONNET = "claude-sonnet-5-5";
const MAX_TURNS = 7;
const REPLAY_FILE = path.join(process.cwd(), "data", "replay.json");

const client = new Anthropic();
const units: Unit[] = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "units.json"), "utf8"));

const SYSTEM = `You are Kidhar?, a dispatch locator for Mumbai emergency services. Callers describe places with landmarks in Hinglish, not addresses.
Work out WHERE the incident is and WHAT it is.
- Extract every landmark and spatial relation (peeche=behind, saamne=opposite, ke paas=near, ke bagal mein=beside, uper/neeche=above/below).
- Use the geocode tool to look landmarks up (max 4 lookups). Prefer short queries ("Kirti College Dadar"). Results are OpenStreetMap, so they can be wrong or missing: reject candidates outside the stated area and say why.
- Use distance to sanity-check candidates against each other.
- Call finalize exactly once. The pin must sit near coordinates you actually got from geocode results (offset only slightly for relations like "behind"). Radius is your honest uncertainty in metres: tight (80-200) when 2+ landmarks agree, wide (800-2500) when ambiguous.
- Each landmark you mark used=true must carry the exact lat/lon of the geocode candidate you chose.
- If it is ambiguous, say so, widen the radius, and write follow-up questions that would shrink the circle.
Never invent coordinates.`;

const DISPATCH_SYSTEM =
  "Write a short emergency dispatch card. Reply with ONLY JSON: " +
  '{"summary": string (max 25 words, location and incident), "dispatch_note": string (max 25 words, what responders should know), "caller_sms": string (max 30 words, calm reassurance in the language and script style of the caller, tell them to stay safe and answer follow-up questions; if sms_language is given, write it in that language)}.' +
  "Do not invent facts beyond the input.";

const tools: Anthropic.Tool[] = [
  {
    name: "geocode",
    description: "Look up a place in Mumbai on OpenStreetMap. Returns up to 5 candidates with lat/lon.",
    input_schema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "distance",
    description: "Straight-line distance in metres between two coordinates.",
    input_schema: {
      type: "object",
      properties: { lat1: { type: "number" }, lon1: { type: "number" }, lat2: { type: "number" }, lon2: { type: "number" } },
      required: ["lat1", "lon1", "lat2", "lon2"],
    },
  },
  {
    name: "finalize",
    description: "Submit the final location and incident assessment. Ends the task.",
    input_schema: {
      type: "object",
      properties: {
        incident_type: { type: "string", enum: ["fire", "medical", "crime", "accident", "other"] },
        severity: { type: "integer", minimum: 1, maximum: 5 },
        services: { type: "array", items: { type: "string", enum: ["fire", "police", "ambulance"] } },
        caller_language: { type: "string" },
        landmarks: {
          type: "array",
          items: {
            type: "object",
            properties: { text: { type: "string" }, resolved_name: { type: "string" }, lat: { type: "number" }, lon: { type: "number" }, used: { type: "boolean" } },
            required: ["text", "used"],
          },
        },
        pin: { type: "object", properties: { lat: { type: "number" }, lon: { type: "number" } }, required: ["lat", "lon"] },
        radius_m: { type: "number" },
        reasoning_steps: { type: "array", items: { type: "string" } },
        follow_up_questions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 2 },
      },
      required: ["incident_type", "severity", "services", "pin", "radius_m", "landmarks", "reasoning_steps", "follow_up_questions"],
    },
  },
];

function readReplay(): Record<string, any[]> {
  try {
    return JSON.parse(fs.readFileSync(REPLAY_FILE, "utf8"));
  } catch {
    return {};
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    message: string;
    replay?: boolean;
    sms_language?: string;
    gps?: { lat: number; lon: number; accuracy_m: number } | null;
    source?: "dispatcher" | "citizen";
  };
  const { replay, sms_language } = body;
  const source = body.source === "citizen" ? "citizen" : "dispatcher";
  const message = String(body.message ?? "");
  const gps = body.gps && Number.isFinite(body.gps.lat) && Number.isFinite(body.gps.lon) ? body.gps : null;

  if (!message.trim()) return Response.json({ error: "Message is empty." }, { status: 400 });
  if (message.length > MAX_MESSAGE_CHARS) return Response.json({ error: `Message too long (max ${MAX_MESSAGE_CHARS} characters).` }, { status: 400 });
  if (!replay) {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const rl = rateLimit(ip);
    if (!rl.ok) return Response.json({ error: `Too many calls. Try again in ${rl.retryAfterSec}s.` }, { status: 429 });
  }

  const key = message.trim().toLowerCase();
  const enc = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const events: any[] = [];
      const raw = (e: any) => controller.enqueue(enc.encode(`data: ${JSON.stringify(e)}\n\n`));
      const send = (e: any) => {
        events.push(e);
        raw(e);
      };
      const playReplay = async (note: string) => {
        const saved = readReplay()[key];
        if (!saved) return false;
        raw({ type: "note", text: note });
        for (const e of saved) {
          if (e.type === "done") {
            const result = saved.find((x) => x.type === "result");
            if (result) {
              const inc = createIncident({
                message,
                result,
                units: saved.find((x) => x.type === "units")?.units ?? [],
                dispatch: saved.find((x) => x.type === "dispatch"),
                gps,
                source,
              });
              raw({ type: "saved", id: inc.id });
            }
          }
          raw(e);
          await new Promise((r) => setTimeout(r, e.type === "step" || e.type === "lookup" ? 700 : 200));
        }
        return true;
      };

      try {
        if (replay && (await playReplay("REPLAY MODE: cached run"))) return;

        const seen: Candidate[] = [];
        let first = message;
        if (gps) {
          seen.push({ name: "Caller device GPS", lat: +gps.lat.toFixed(5), lon: +gps.lon.toFixed(5), type: "gps" });
          first += `\n\n[Caller device GPS: lat ${gps.lat.toFixed(5)}, lon ${gps.lon.toFixed(5)}, accuracy +/-${Math.round(gps.accuracy_m)} m. Treat as evidence, not truth: it can be stale or inaccurate indoors.]`;
        }
        const msgs: Anthropic.MessageParam[] = [{ role: "user", content: first }];
        let final: any = null;

        for (let turn = 0; turn < MAX_TURNS && !final; turn++) {
          const res = await client.messages.create({
            model: OPUS,
            max_tokens: 2000,
            system: SYSTEM,
            tools,
            tool_choice: turn === MAX_TURNS - 1 ? { type: "tool", name: "finalize" } : { type: "auto" },
            messages: msgs,
          });
          msgs.push({ role: "assistant", content: res.content });
          const results: Anthropic.ToolResultBlockParam[] = [];

          for (const b of res.content) {
            if (b.type === "text" && b.text.trim()) send({ type: "step", text: b.text.trim() });
            if (b.type !== "tool_use") continue;
            const input = b.input as any;
            if (b.name === "geocode") {
              send({ type: "step", text: `Looking up: ${input.query}` });
              try {
                const g = await geocode(input.query);
                seen.push(...g.candidates);
                send({ type: "lookup", query: input.query, candidates: g.candidates, cached: g.cached });
                results.push({ type: "tool_result", tool_use_id: b.id, content: JSON.stringify(g.candidates) });
              } catch (err: any) {
                results.push({ type: "tool_result", tool_use_id: b.id, content: `error: ${err.message}`, is_error: true });
              }
            } else if (b.name === "distance") {
              const d = Math.round(haversine({ lat: input.lat1, lon: input.lon1 }, { lat: input.lat2, lon: input.lon2 }));
              results.push({ type: "tool_result", tool_use_id: b.id, content: `${d} metres` });
            } else if (b.name === "finalize") {
              final = input;
              results.push({ type: "tool_result", tool_use_id: b.id, content: "ok" });
            }
          }
          if (!final) msgs.push({ role: "user", content: results });
        }

        if (!final) throw new Error("No final answer from locator");

        // Validation: pin in Mumbai, radius sane, pin grounded in real geocode results.
        let lowConfidence = false;
        const pin = { lat: +final.pin.lat, lon: +final.pin.lon };
        let radius = Math.min(3000, Math.max(50, +final.radius_m || 500));
        if (!inMumbai(pin)) lowConfidence = true;
        const used = (final.landmarks || []).filter((l: any) => l.used && l.lat != null);
        const grounded = used.filter((l: any) => matchesAnyCandidate({ lat: l.lat, lon: l.lon }, seen));
        const nearEvidence = seen.some((c) => haversine(pin, c) < 2500);
        if (used.length === 0 || grounded.length < used.length || !nearEvidence) lowConfidence = true;
        if (lowConfidence) radius = Math.max(radius * 2, 800);

        const checks = [
          { label: "Pin is inside the Mumbai bounding box", pass: inMumbai(pin) },
          { label: `Every landmark used matches a real map result (${grounded.length}/${used.length})`, pass: used.length > 0 && grounded.length === used.length },
          { label: "Pin is within 2.5 km of real map evidence", pass: nearEvidence },
          { label: "Radius is within the allowed 50 m to 3 km range", pass: +final.radius_m >= 50 && +final.radius_m <= 3000 },
        ];

        if (gps) {
          const gap = Math.round(haversine(pin, gps));
          checks.push({ label: `Device GPS agrees with the pin (${gap} m apart, GPS accuracy ±${Math.round(gps.accuracy_m)} m)`, pass: gap <= Math.max(400, gps.accuracy_m * 2) });
        }

        send({
          type: "result",
          checks,
          incident_type: final.incident_type,
          severity: final.severity,
          services: final.services,
          caller_language: final.caller_language,
          landmarks: grounded,
          pin,
          radius_m: Math.round(radius),
          reasoning_steps: final.reasoning_steps,
          follow_up_questions: final.follow_up_questions,
          low_confidence: lowConfidence,
        });

        send({ type: "units", units: nearestUnits(pin, units) });

        const card = await client.messages.create({
          model: SONNET,
          max_tokens: 700,
          system: DISPATCH_SYSTEM,
          messages: [
            {
              role: "user",
              content: JSON.stringify({
                message,
                incident: final.incident_type,
                severity: final.severity,
                services: final.services,
                landmarks: grounded.map((l: any) => l.resolved_name || l.text),
                radius_m: Math.round(radius),
                language: final.caller_language,
                sms_language: sms_language || undefined,
                low_confidence: lowConfidence,
              }),
            },
          ],
        });
        const block = card.content.find((c) => c.type === "text") as { text: string } | undefined;
        try {
          const text = block!.text;
          send({ type: "dispatch", ...JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) });
        } catch {
          send({ type: "dispatch", summary: "Dispatch card unavailable", dispatch_note: "", caller_sms: "" });
        }

        const inc = createIncident({
          message,
          result: events.find((e) => e.type === "result"),
          units: events.find((e) => e.type === "units")?.units ?? [],
          dispatch: events.find((e) => e.type === "dispatch"),
          gps,
          source,
        });
        send({ type: "saved", id: inc.id });
        send({ type: "done" });
        const all = readReplay();
        all[key] = events.filter((e) => e.type !== "saved");
        try {
          fs.writeFileSync(REPLAY_FILE, JSON.stringify(all));
        } catch {}
      } catch (err: any) {
        if (!(await playReplay(`Live call failed (${err.message}); showing cached run`))) {
          raw({ type: "error", text: err.message });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform" } });
}
