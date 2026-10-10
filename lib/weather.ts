/** Live weather from Open-Meteo (free, no API key). Server-side only; never throws. */
export type Weather = {
  tempC: number;
  feelsC: number;
  humidity: number;
  precipMm: number;
  code: number;
  label: string;
  windKmh: number;
  windFromDeg: number;
  windToward: string;
  gustKmh: number;
  observedAt: string;
  fetchedAt: number;
  source: "Open-Meteo";
};

export type WeatherImpact = {
  intensity: "none" | "light" | "moderate" | "heavy";
  etaFactor: number;
  etaReason: string;
  notes: { text: string; level: "info" | "warn" }[];
};

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const compass = (deg: number) => COMPASS[Math.round(((deg % 360) + 360) % 360 / 45) % 8];

const LABELS: Record<number, string> = {
  0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast", 45: "Fog", 48: "Fog",
  51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle", 56: "Freezing drizzle", 57: "Freezing drizzle",
  61: "Light rain", 63: "Rain", 65: "Heavy rain", 66: "Freezing rain", 67: "Freezing rain",
  80: "Light showers", 81: "Showers", 82: "Violent showers", 95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
};

const CACHE_MS = 5 * 60_000;
const cache = new Map<string, { at: number; w: Weather }>();

export async function getWeather(lat: number, lon: number): Promise<Weather | null> {
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.w;
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}` +
      `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Asia%2FKolkata`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000), cache: "no-store" });
    if (!res.ok) return null;
    const c = (await res.json()).current;
    const w: Weather = {
      tempC: c.temperature_2m,
      feelsC: c.apparent_temperature,
      humidity: c.relative_humidity_2m,
      precipMm: c.precipitation,
      code: c.weather_code,
      label: LABELS[c.weather_code] ?? "Unknown",
      windKmh: c.wind_speed_10m,
      windFromDeg: c.wind_direction_10m,
      windToward: compass(c.wind_direction_10m + 180),
      gustKmh: c.wind_gusts_10m,
      observedAt: c.time,
      fetchedAt: Date.now(),
      source: "Open-Meteo",
    };
    cache.set(key, { at: Date.now(), w });
    return w;
  } catch {
    return null;
  }
}

/** Deterministic impact rules. The multipliers are assumptions, not measurements. */
export function weatherImpact(w: Weather, incidentType?: string): WeatherImpact {
  const heavy = [95, 96, 99, 65, 67, 82].includes(w.code) || w.precipMm >= 2;
  const moderate = [63, 81, 55, 57, 66].includes(w.code) || w.precipMm >= 0.5;
  const light = [51, 53, 61, 80, 56].includes(w.code) || w.precipMm > 0;
  const intensity: WeatherImpact["intensity"] = heavy ? "heavy" : moderate ? "moderate" : light ? "light" : "none";
  const fog = w.code === 45 || w.code === 48;

  let etaFactor = 1;
  let etaReason = "Dry roads, no weather delay assumed";
  if (intensity === "heavy") { etaFactor = 1.5; etaReason = "Heavy rain: ETAs +50% (assumed)"; }
  else if (intensity === "moderate") { etaFactor = 1.25; etaReason = "Moderate rain: ETAs +25% (assumed)"; }
  else if (intensity === "light") { etaFactor = 1.1; etaReason = "Light rain: ETAs +10% (assumed)"; }
  else if (fog) { etaFactor = 1.15; etaReason = "Fog: ETAs +15% (assumed)"; }

  const notes: WeatherImpact["notes"] = [];
  if (intensity === "heavy") notes.push({ level: "warn", text: "Waterlogging likely on low-lying roads. Check access routes." });
  if (w.gustKmh >= 50) notes.push({ level: "warn", text: `Gusts up to ${Math.round(w.gustKmh)} km/h. Aerial or high-reach operations may be limited.` });
  if (incidentType === "fire" && w.windKmh >= 20) {
    notes.push({ level: "warn", text: `Wind ${Math.round(w.windKmh)} km/h from ${compass(w.windFromDeg)}: fire and smoke may spread toward the ${w.windToward}.` });
  } else if (incidentType === "fire") {
    notes.push({ level: "info", text: `Light wind (${Math.round(w.windKmh)} km/h): smoke drifts toward the ${w.windToward}.` });
  }
  if (incidentType === "medical" && w.feelsC >= 40) notes.push({ level: "warn", text: `Feels like ${Math.round(w.feelsC)}°C: consider heat stress as a factor.` });
  if (w.feelsC >= 45) notes.push({ level: "warn", text: "Extreme heat. Responders need hydration and rest cycles." });
  if (!notes.length) notes.push({ level: "info", text: "No weather hazards flagged for this incident." });

  return { intensity, etaFactor, etaReason, notes };
}
