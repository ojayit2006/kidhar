import { getWeather, weatherImpact } from "@/lib/weather";
import { inMumbai } from "@/lib/geo";

const MUMBAI = { lat: 19.076, lon: 72.8777 };

/** Live weather for a point in Mumbai. Cached for 5 minutes per ~1 km cell. */
export async function GET(req: Request) {
  const u = new URL(req.url);
  const lat = Number(u.searchParams.get("lat") ?? MUMBAI.lat);
  const lon = Number(u.searchParams.get("lon") ?? MUMBAI.lon);
  const type = u.searchParams.get("type") ?? undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || !inMumbai({ lat, lon })) {
    return Response.json({ error: "Coordinates must be inside Mumbai." }, { status: 400 });
  }
  const weather = await getWeather(lat, lon);
  if (!weather) return Response.json({ error: "Weather service unavailable." }, { status: 502 });
  return Response.json({ weather, impact: weatherImpact(weather, type) });
}
