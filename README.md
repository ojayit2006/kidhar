# Kidhar? Emergency Locator for Mumbai

In India we do not give addresses, we give landmarks. Kidhar? turns a Hinglish call like "Kirti College ke peeche, building mein aag lagi hai" into a map pin with an honest uncertainty circle, the nearest fire, police and hospital units, and a dispatch card.

**AI locates, code computes, a human decides.**

- Claude Opus 5.5 reads the call, looks landmarks up on OpenStreetMap and commits to a pin.
- Code validates the pin (inside Mumbai, backed by real geocode results), finds nearest units and ETAs.
- Claude Sonnet 5.5 writes the dispatch card and a calm SMS in English, Hindi or Marathi.

## Pages

- `/` choose role and language
- `/dispatch` control-room console: live queue, map, unit dispatch (simulated), caller replies
- `/incidents` log and hotspot map, `/incidents/[id]` full record
- `/report` citizen page: describe the emergency, share GPS, voice input
- `/track/[id]` citizen tracking: live status and ETA
- `/admin` password-protected operations panel: stats, incident management, CSV export, health, cache controls
- `/how` how it works and limits

## Run

```bash
npm install
cp .env.example .env.local   # add ANTHROPIC_API_KEY
npm run dev
```

Environment (`.env.local`): `ANTHROPIC_API_KEY`, `ADMIN_PASSWORD` (enables `/admin`), and optionally `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

**Storage:** with the Supabase variables set, incidents live in Supabase (run `supabase/schema.sql` once in the SQL editor). Without them the app falls back to `data/incidents.json`, which only works on a writable filesystem, so use Supabase when deploying.

**Weather:** live conditions come from Open-Meteo (free, no key). They adjust ETAs (rain and fog slow units, with assumed multipliers), flag wind-driven fire spread, and refresh every 5 minutes on the dispatch page.

If styles ever look stale in dev, stop the server, delete `.next`, and restart.

## Limits

Prototype on OpenStreetMap data. ETAs are straight-line distance x 1.4 at an assumed speed, not live traffic. Unit movement is simulated at 8x speed. It is not connected to 112 or any real control room. Per-IP rate limit and a 600-character message cap protect the API key.
