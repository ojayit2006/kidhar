export type Unit = { type: "police" | "fire" | "hospital"; name: string; lat: number; lon: number };
export type LatLon = { lat: number; lon: number };

export const MUMBAI_BBOX = { south: 18.89, west: 72.77, north: 19.28, east: 72.99 };

export function inMumbai(p: LatLon) {
  return p.lat >= MUMBAI_BBOX.south && p.lat <= MUMBAI_BBOX.north && p.lon >= MUMBAI_BBOX.west && p.lon <= MUMBAI_BBOX.east;
}

export function haversine(a: LatLon, b: LatLon) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const SPEED_KMH = { fire: 25, police: 20, hospital: 20 } as const;
const ROAD_FACTOR = 1.4;

export function nearestUnits(pin: LatLon, units: Unit[], perType = 2) {
  const out: (Unit & { distance_m: number; road_m: number; eta_min: number })[] = [];
  for (const type of ["fire", "police", "hospital"] as const) {
    units
      .filter((u) => u.type === type && !u.name.endsWith("(unnamed)"))
      .map((u) => ({ ...u, distance_m: haversine(pin, u) }))
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, perType)
      .forEach((u) => {
        const road_m = u.distance_m * ROAD_FACTOR;
        out.push({ ...u, distance_m: Math.round(u.distance_m), road_m: Math.round(road_m), eta_min: Math.max(1, Math.round(road_m / 1000 / SPEED_KMH[type] * 60)) });
      });
  }
  return out;
}
