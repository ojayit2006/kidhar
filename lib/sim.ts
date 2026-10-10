/** Simulated unit movement. Real time is compressed so a 4-minute ETA plays out in about 30 seconds. */
export const SPEEDUP = 8;

export function progress(a: { dispatchedAt: number; eta_min: number }, now: number) {
  const total = (a.eta_min * 60_000) / SPEEDUP;
  return Math.max(0, Math.min(1, (now - a.dispatchedAt) / total));
}

export function remainingMin(a: { dispatchedAt: number; eta_min: number }, now: number) {
  return Math.max(0, Math.ceil(a.eta_min * (1 - progress(a, now))));
}

export function lerpPoint(from: { lat: number; lon: number }, to: { lat: number; lon: number }, t: number) {
  return { lat: from.lat + (to.lat - from.lat) * t, lon: from.lon + (to.lon - from.lon) * t };
}

export const STATUS_LABEL = { new: "New", dispatched: "Dispatched", on_scene: "On scene", resolved: "Resolved" } as const;
export const STATUS_COLOR = { new: "#dc2626", dispatched: "#d97706", on_scene: "#2f7dff", resolved: "#16a34a" } as const;
