import { listIncidents } from "./store";

/**
 * Relative-risk outlook for the next 24 hours.
 *
 * This is NOT a prediction of specific events and it does not know how many calls Mumbai will get. It combines:
 *  1. the real hourly weather forecast (Open-Meteo)           -> FACT
 *  2. assumed time-of-day activity patterns (rush hours etc.)  -> ASSUMPTION, not learned from Mumbai records
 *  3. this app's own incident history, blended in as it grows  -> LEARNED (weight shown to the user)
 * and reports risk as a multiple of a typical hour (1.0x = typical).
 */

export type Cat = "accident" | "medical" | "fire" | "crime" | "waterlogging";
export type Level = "normal" | "elevated" | "high" | "severe";

export const CATS: Cat[] = ["accident", "medical", "fire", "crime", "waterlogging"];
export const CAT_LABEL: Record<Cat, string> = { accident: "Road accidents", medical: "Medical emergencies", fire: "Fire", crime: "Crime and threats", waterlogging: "Waterlogging" };

export type HourWeather = { tempC: number; feelsC: number; humidity: number; precipMm: number; precipProb: number; windKmh: number; gustKmh: number; code: number };

export type HourRisk = { index: number; level: Level; drivers: string[] };

export type ForecastHour = { time: string; hour: number; weather: HourWeather; risk: Record<Cat, HourRisk> };

export type Recommendation = { level: Level; text: string; basis: ("weather" | "time pattern" | "history")[] };

export type Forecast = {
  generatedAt: number;
  hours: ForecastHour[];
  next6: Record<Cat, { max: number; level: Level; window: string | null }>;
  recommendations: Recommendation[];
  history: { total: number; counts: Record<Cat, number>; weights: Record<Cat, number> };
  hotspots: { lat: number; lon: number; score: number; types: string[] }[];
  notes: string[];
};

// Assumed typical urban hour-of-day activity (index 0 to 23). Normalised to a mean of 1 below.
const RAW_PROFILE: Record<Exclude<Cat, "waterlogging">, number[]> = {
  accident: [0.4, 0.3, 0.3, 0.3, 0.4, 0.6, 0.9, 1.3, 1.7, 1.8, 1.4, 1.1, 1.1, 1.1, 1.1, 1.1, 1.3, 1.7, 1.9, 1.8, 1.5, 1.0, 0.8, 0.6],
  medical: [0.6, 0.5, 0.5, 0.5, 0.6, 0.7, 0.9, 1.1, 1.2, 1.3, 1.3, 1.3, 1.2, 1.2, 1.1, 1.1, 1.1, 1.1, 1.2, 1.2, 1.1, 1.0, 0.8, 0.7],
  fire: [0.7, 0.6, 0.6, 0.6, 0.6, 0.7, 0.8, 0.9, 1.0, 1.0, 1.0, 1.0, 1.1, 1.2, 1.2, 1.1, 1.1, 1.3, 1.5, 1.7, 1.7, 1.5, 1.2, 0.9],
  crime: [1.6, 1.4, 1.1, 0.8, 0.5, 0.4, 0.4, 0.5, 0.6, 0.7, 0.7, 0.8, 0.8, 0.8, 0.9, 0.9, 1.0, 1.1, 1.3, 1.5, 1.7, 1.9, 1.9, 1.8],
};
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const PROFILE = Object.fromEntries(Object.entries(RAW_PROFILE).map(([k, v]) => [k, v.map((x) => x / mean(v))])) as Record<Exclude<Cat, "waterlogging">, number[]>;

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

export const levelOf = (index: number): Level => (index >= 2.3 ? "severe" : index >= 1.7 ? "high" : index >= 1.25 ? "elevated" : "normal");
const LEVEL_RANK: Record<Level, number> = { normal: 0, elevated: 1, high: 2, severe: 3 };

const IST_MS = 5.5 * 3600_000;
const istParts = (ms: number) => {
  const d = new Date(ms + IST_MS);
  return { key: d.toISOString().slice(0, 13), hour: d.getUTCHours() };
};

function timeLabel(cat: Exclude<Cat, "waterlogging">, h: number): string | null {
  if (cat === "accident") return (h >= 7 && h <= 10) ? "morning rush hour" : (h >= 17 && h <= 20) ? "evening rush hour" : null;
  if (cat === "fire") return h >= 18 && h <= 22 ? "evening cooking and electrical load" : null;
  if (cat === "crime") return h >= 21 || h <= 2 ? "late-night pattern" : null;
  return h >= 9 && h <= 12 ? "daytime peak" : null;
}

/** Smoothed hour-of-day distribution from past incidents, normalised to a mean of 1. */
function empiricalProfile(hours: number[]): number[] {
  const counts = new Array(24).fill(0);
  for (const h of hours) counts[h] += 1;
  const smooth = counts.map((_, h) => (counts[(h + 23) % 24] * 0.5 + counts[h] + counts[(h + 1) % 24] * 0.5) / 2);
  const m = mean(smooth) || 1;
  return smooth.map((x) => x / m);
}

async function fetchHourly() {
  const url =
    "https://api.open-meteo.com/v1/forecast?latitude=19.076&longitude=72.8777" +
    "&hourly=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,precipitation_probability,weather_code,wind_speed_10m,wind_gusts_10m" +
    "&forecast_days=3&timezone=Asia%2FKolkata";
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" });
  if (!res.ok) throw new Error(`Weather forecast unavailable (${res.status})`);
  return (await res.json()).hourly as Record<string, (number | string)[]>;
}

function dedupe(a: string[]) {
  return a.filter((x, i) => a.indexOf(x) === i);
}

function window(hours: ForecastHour[], cat: Cat, minLevel: Level): string | null {
  const hit = hours.filter((h) => LEVEL_RANK[h.risk[cat].level] >= LEVEL_RANK[minLevel]);
  if (!hit.length) return null;
  const fmt = (h: ForecastHour) => `${String(h.hour).padStart(2, "0")}:00`;
  return hit.length === 1 ? fmt(hit[0]) : `${fmt(hit[0])} to ${fmt(hit[hit.length - 1])}`;
}

export async function buildForecast(): Promise<Forecast> {
  const hourly = await fetchHourly();
  const times = hourly.time as string[];

  // Start at the current IST hour.
  const nowKey = istParts(Date.now()).key;
  let start = times.findIndex((t) => t.slice(0, 13) === nowKey);
  if (start < 0) start = 0;

  // History: aggregate counts and hour-of-day only (no personal data leaves this function).
  let incidents: Awaited<ReturnType<typeof listIncidents>> = [];
  try {
    incidents = await listIncidents();
  } catch {
    // forecast still works from weather and assumed patterns
  }
  const cutoff = Date.now() - 90 * 86_400_000;
  const recent = incidents.filter((i) => i.createdAt >= cutoff && i.result);
  const catOf = (t: string): Cat | null => (t === "fire" || t === "medical" || t === "accident" || t === "crime" ? t : null);
  const byCatHours: Record<Cat, number[]> = { accident: [], medical: [], fire: [], crime: [], waterlogging: [] };
  for (const i of recent) {
    const c = catOf(i.result.incident_type);
    if (c) byCatHours[c].push(istParts(i.createdAt).hour);
  }
  const counts = Object.fromEntries(CATS.map((c) => [c, byCatHours[c].length])) as Record<Cat, number>;
  // History weight grows with data and is capped so the assumed pattern never disappears entirely.
  const weights = Object.fromEntries(CATS.map((c) => [c, c === "waterlogging" ? 0 : +Math.min(0.7, counts[c] / 40).toFixed(2)])) as Record<Cat, number>;
  const empirical = Object.fromEntries(
    (["accident", "medical", "fire", "crime"] as const).map((c) => [c, byCatHours[c].length >= 3 ? empiricalProfile(byCatHours[c]) : null]),
  ) as Record<"accident" | "medical" | "fire" | "crime", number[] | null>;

  const hours: ForecastHour[] = [];
  for (let n = 0; n < 24 && start + n < times.length; n++) {
    const i = start + n;
    const g = (k: string) => Number(hourly[k][i]) || 0;
    const w: HourWeather = {
      tempC: g("temperature_2m"),
      feelsC: g("apparent_temperature"),
      humidity: g("relative_humidity_2m"),
      precipMm: g("precipitation"),
      precipProb: g("precipitation_probability"),
      windKmh: g("wind_speed_10m"),
      gustKmh: g("wind_gusts_10m"),
      code: g("weather_code"),
    };
    const hour = Number(times[i].slice(11, 13));
    const prev3 = [1, 2, 3].reduce((s, d) => s + (i - d >= 0 ? Number(hourly.precipitation[i - d]) || 0 : 0), 0);

    const risk = {} as Record<Cat, HourRisk>;

    for (const c of ["accident", "medical", "fire", "crime"] as const) {
      const prior = PROFILE[c][hour];
      const emp = empirical[c];
      const wgt = emp ? weights[c] : 0;
      const timeFactor = (1 - wgt) * prior + wgt * (emp ? emp[hour] : prior);
      const drivers: string[] = [];
      const tl = timeLabel(c, hour);
      if (timeFactor >= 1.3) drivers.push(tl ?? "busy hour for this type");
      if (wgt > 0.15 && emp && emp[hour] >= 1.5) drivers.push("matches your own incident history");

      let wx = 1;
      if (c === "accident") {
        const wet = clamp(w.precipMm / 6, 0, 1);
        wx *= 1 + 0.7 * wet;
        if (wet > 0.15) drivers.push(`wet roads (${w.precipMm.toFixed(1)} mm/h)`);
        if (w.code === 45 || w.code === 48) { wx *= 1.2; drivers.push("fog"); }
        if (w.code >= 95) { wx *= 1.15; drivers.push("thunderstorm"); }
        if (w.gustKmh >= 50) { wx *= 1.1; drivers.push(`gusts ${Math.round(w.gustKmh)} km/h`); }
      } else if (c === "medical") {
        const heat = Math.max(0, w.feelsC - 35);
        wx *= Math.min(1.6, 1 + 0.05 * heat);
        if (heat >= 3) drivers.push(`heat stress (feels ${Math.round(w.feelsC)}°C)`);
      } else if (c === "fire") {
        const wind = Math.max(0, w.windKmh - 15);
        wx *= Math.min(1.5, 1 + 0.02 * wind);
        if (wind >= 5) drivers.push(`strong wind (${Math.round(w.windKmh)} km/h) can spread fire`);
        if (w.precipMm === 0 && w.humidity < 35) { wx *= 1.15; drivers.push("dry air"); }
        if (w.precipMm >= 1) wx *= 0.7;
      }
      const index = +(timeFactor * wx).toFixed(2);
      risk[c] = { index, level: levelOf(index), drivers: dedupe(drivers) };
    }

    // Waterlogging depends on rain only: current intensity plus rain that has just fallen.
    const wl = 0.2 + w.precipMm / 2.5 + 0.15 * prev3;
    const wlDrivers: string[] = [];
    if (w.precipMm >= 2.5) wlDrivers.push(`rain ${w.precipMm.toFixed(1)} mm/h`);
    if (prev3 >= 6) wlDrivers.push(`${prev3.toFixed(0)} mm in the last 3 hours`);
    if (w.code >= 95) wlDrivers.push("thunderstorm");
    risk.waterlogging = { index: +wl.toFixed(2), level: levelOf(wl), drivers: wlDrivers };

    hours.push({ time: times[i], hour, weather: w, risk });
  }

  const first6 = hours.slice(0, 6);
  const next6 = Object.fromEntries(
    CATS.map((c) => {
      const max = Math.max(...first6.map((h) => h.risk[c].index));
      return [c, { max: +max.toFixed(2), level: levelOf(max), window: window(first6, c, "elevated") }];
    }),
  ) as Forecast["next6"];

  // Readiness recommendations: simple rules over the computed outlook.
  const recommendations: Recommendation[] = [];
  const add = (level: Level, text: string, basis: Recommendation["basis"]) => recommendations.push({ level, text, basis });
  const maxLevel = (c: Cat): Level => hours.map((h) => h.risk[c].level).sort((a, b) => LEVEL_RANK[b] - LEVEL_RANK[a])[0];
  const win = (c: Cat) => window(hours, c, "high") ?? window(hours, c, "elevated");

  if (LEVEL_RANK[maxLevel("waterlogging")] >= 1) {
    const lv = maxLevel("waterlogging");
    add(lv, `Heavy rain expected${win("waterlogging") ? ` (${win("waterlogging")})` : ""}. Pre-alert BMC disaster control (1916), check flood-prone approach roads before dispatching, and expect ETAs to rise by 25 to 50%.`, ["weather"]);
  }
  if (LEVEL_RANK[maxLevel("accident")] >= 2) {
    const wet = hours.some((h) => h.risk.accident.drivers.some((d) => d.startsWith("wet")));
    add(maxLevel("accident"), `Accident risk is ${maxLevel("accident")} (${win("accident")}). Keep ambulances and traffic police on standby near main roads and junctions.`, wet ? ["weather", "time pattern"] : ["time pattern"]);
  }
  if (LEVEL_RANK[maxLevel("fire")] >= 2) {
    add(maxLevel("fire"), `Fire risk is ${maxLevel("fire")} (${win("fire")}). Consider pre-positioning fire tenders and warning crews about wind-driven spread.`, ["weather", "time pattern"]);
  }
  if (LEVEL_RANK[maxLevel("medical")] >= 2) {
    add(maxLevel("medical"), `Heat stress is raising medical-call risk (${win("medical")}). Brief ambulance crews on heat illness and keep hydration supplies on board.`, ["weather"]);
  }
  if (LEVEL_RANK[maxLevel("crime")] >= 2) {
    add(maxLevel("crime"), `Late-evening and night pattern raises threat calls (${win("crime")}). Keep police response capacity visible near stations.`, ["time pattern"]);
  }
  if (!recommendations.length) add("normal", "No elevated risk expected in the next 24 hours. Normal staffing is appropriate.", ["weather", "time pattern"]);

  // Spatial hotspots only once there is enough history to say anything.
  const hotspots: Forecast["hotspots"] = [];
  const located = recent.filter((i) => i.result?.pin);
  if (located.length >= 8) {
    const cells = new Map<string, { lat: number; lon: number; score: number; types: Set<string> }>();
    const step = 0.02;
    for (const i of located) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const clat = Math.round(i.result.pin.lat / step) * step + dy * step;
          const clon = Math.round(i.result.pin.lon / step) * step + dx * step;
          const d = Math.hypot((clat - i.result.pin.lat) * 111, (clon - i.result.pin.lon) * 105);
          const wgt = Math.exp(-(d * d) / (2 * 2.5 * 2.5));
          const k = `${clat.toFixed(3)},${clon.toFixed(3)}`;
          const cell = cells.get(k) ?? { lat: clat, lon: clon, score: 0, types: new Set<string>() };
          cell.score += wgt;
          cell.types.add(i.result.incident_type);
          cells.set(k, cell);
        }
      }
    }
    [...cells.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .forEach((c) => hotspots.push({ lat: +c.lat.toFixed(3), lon: +c.lon.toFixed(3), score: +c.score.toFixed(2), types: [...c.types] }));
  }

  const total = recent.length;
  const notes = [
    "This is a relative-risk outlook (1.0x is a typical hour), not a forecast of specific incidents or call volumes.",
    "Weather values are real forecasts from Open-Meteo. The risk multipliers and hourly patterns are assumptions, not learned from Mumbai records.",
    total < 20
      ? `Only ${total} incident${total === 1 ? "" : "s"} recorded so far, so the outlook leans on the assumed patterns. Your own history is blended in as it grows.`
      : `${total} incidents from the last 90 days are blended into the hourly patterns where there is enough data per type.`,
    located.length < 8 ? "Area hotspots appear once at least 8 located incidents are recorded." : "Hotspots show where past incidents clustered, not where the next one will happen.",
  ];

  return { generatedAt: Date.now(), hours, next6, recommendations, history: { total, counts, weights }, hotspots, notes };
}
