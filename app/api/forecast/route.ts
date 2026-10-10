import Anthropic from "@anthropic-ai/sdk";
import { buildForecast, CAT_LABEL, CATS, type Forecast } from "@/lib/forecast";

export const maxDuration = 60;

const SONNET = "claude-sonnet-5-5";
const CACHE_MS = 10 * 60_000;
let cache: { at: number; f: Forecast } | null = null;
let briefCache: { at: number; text: string } | null = null;

async function brief(f: Forecast): Promise<string | null> {
  if (briefCache && Date.now() - briefCache.at < 30 * 60_000) return briefCache.text;
  try {
    const client = new Anthropic();
    const facts = {
      next6: CATS.map((c) => ({ type: CAT_LABEL[c], level: f.next6[c].level, times_normal: f.next6[c].max, window: f.next6[c].window })),
      recommendations: f.recommendations.map((r) => r.text),
      incidents_recorded: f.history.total,
    };
    const res = await client.messages.create({
      model: SONNET,
      max_tokens: 1500,
      system:
        "You write a short control-room outlook briefing for the next hours in Mumbai. Use ONLY the numbers and facts provided. 3 to 4 short bullet lines, plain language, no invented causes, no guarantees, " +
        "and say the outlook is a relative-risk estimate, not a prediction of specific events. If incidents_recorded is under 20, state that it leans on assumed patterns.",
      messages: [{ role: "user", content: JSON.stringify(facts) }],
    });
    const block = res.content.find((c) => c.type === "text") as { text: string } | undefined;
    const text = block?.text?.replaceAll("**", "").trim() ?? null;
    if (text && text.length > 60) briefCache = { at: Date.now(), text };
    return text && text.length > 60 ? text : null;
  } catch {
    return null;
  }
}

/** Public outlook. Uses aggregate counts only; no incident details leave the server. */
export async function GET(req: Request) {
  try {
    if (!cache || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), f: await buildForecast() };
    const wantBrief = new URL(req.url).searchParams.get("brief") === "1";
    return Response.json({ forecast: cache.f, briefing: wantBrief ? await brief(cache.f) : null });
  } catch (err: any) {
    return Response.json({ error: err.message ?? "Forecast unavailable" }, { status: 502 });
  }
}
