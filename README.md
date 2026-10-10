# Kidhar?

**Emergency dispatch that understands landmarks.**

In Mumbai nobody says "19.0214 N, 72.8311 E". They say *"Dadar West, Kirti College ke peeche, jahan pehle Pancham sweets tha."* Control rooms lose minutes turning sentences like that into a location. Kidhar? does it in seconds: it reads the call in Hinglish, finds the place on the map, shows how sure it is, lines up the nearest fire, police and ambulance units, and opens a ticket that a dispatcher can run from first call to closure.

Citizens get their own side of the product: report an emergency in English, Hindi or Marathi, follow help as it arrives, get safety steps while they wait, and find the nearest hospital or police station in one tap.

> AI locates. Code computes. A human decides.

---

## Contents

- [Highlights](#highlights)
- [How a call is handled](#how-a-call-is-handled)
- [Capabilities](#capabilities)
  - [Locator](#locator)
  - [Dispatcher console](#dispatcher-console)
  - [Ticketing](#ticketing)
  - [Incident records](#incident-records)
  - [Citizen app](#citizen-app)
  - [Outlook](#outlook)
  - [Weather intelligence](#weather-intelligence)
  - [Admin](#admin)
  - [Storage](#storage)
  - [Security and privacy](#security-and-privacy)
  - [Design](#design)
- [Pages and API](#pages-and-api)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [Data sources](#data-sources)
- [Scope and status](#scope-and-status)
- [Roadmap](#roadmap)

---

## Highlights

- **Landmark-first location.** Understands *peeche, saamne, ke paas, ke bagal mein*, combines several landmarks, and returns a pin with an honest uncertainty circle.
- **Grounded, not guessed.** Every pin is checked by code against real map results before it is shown, and every value carries a label saying where it came from.
- **A ticket for every call.** Priority, response-time targets, flags, ownership, escalation, notes, an audit trail and mandatory outcomes.
- **Live unit dispatch.** Assign the nearest unit, watch it travel to the scene, and see the incident close itself out as units arrive.
- **Weather-aware.** Real-time conditions adjust ETAs and warn responders about wind-driven fire, gusts, heat and waterlogging.
- **Look-ahead outlook.** A 24-hour relative-risk view for accidents, medical, fire, crime and waterlogging.
- **Built for the public too.** Report, track, safety guidance, nearby help and helplines in three languages.
- **Works offline-ish.** Cached runs replay instantly if the network or the AI service is down.

---

## How a call is handled

```
 Caller message (Hinglish, optional device GPS)
        │
        ▼
 Locator (Opus 5.5)        extracts landmarks and relations, then calls:
                           geocode(query) · distance(a, b) · finalize(result)
        │                  geocoding: OpenStreetMap, Mumbai viewbox, cached, 1 request per second
        ▼
 Validation (code)         pin inside Mumbai · every landmark matches a real map result ·
                           pin near real evidence · radius 50 m to 3 km · GPS agrees
        │                  any failure widens the circle and flags low confidence
        ▼
 Weather and units (code)  live conditions → weather-adjusted ETAs and hazard notes;
                           nearest fire, police and hospital from a saved OpenStreetMap extract
        ▼
 Dispatch card (Sonnet 5.5) summary, responder note and a calm SMS to the caller
                           in English, Hindi or Marathi, written from the facts only
        ▼
 Ticket                    priority · response timer · flags · owner · notes · outcome
```

The model never does arithmetic and never invents coordinates. Distances, ETAs, nearest units, confidence and risk indices are all computed by code.

---

## Capabilities

### Locator

- **Landmark reasoning.** Reads Hinglish and English, extracts each landmark and its spatial relation, looks them up, rejects candidates that contradict the described area, and commits to a pin.
- **Honest uncertainty.** Every pin comes with a radius from 50 m to 3 km. A call with two agreeing landmarks gets a tight circle; *"Andheri mein metro ke neeche"* gets about 2 km and two questions to narrow it.
- **Live reasoning trace.** Each lookup, rejected candidate and decision streams to the screen as it happens.
- **Tool-use loop.** Up to seven turns across `geocode`, `distance` and `finalize`.
- **Geocoding with guard rails.** OpenStreetMap Nominatim, bounded to a Mumbai viewbox, throttled to one request per second with a proper User-Agent, every lookup cached in `data/geocache.json`.
- **Grounding checks.** Pin inside the Mumbai bounding box; every landmark used matches a real geocode result; pin within 2.5 km of real map evidence; radius within range; device GPS agrees with the pin. Failures widen the circle (to at least 800 m) and show **LOW CONFIDENCE**. The **Grounding** tab lists every check as pass or fail.
- **Device GPS as evidence.** The caller's GPS position and accuracy go to the locator as a fact. With a vague or empty description it centres on the GPS point; if GPS and description disagree it says so and widens the circle.
- **Follow-up questions.** Two questions with every result, chosen to shrink the circle.
- **Caller replies.** Type what the caller answered and the whole conversation is re-run, so the location is re-estimated and the circle can tighten.
- **Nearest units.** Two nearest fire stations, police stations and hospitals from `data/units.json` (1,087 hospitals, 121 police stations, 34 fire stations).
- **Computed ETAs.** Straight-line distance × 1.4 road factor at assumed speeds (fire 25 km/h, police and hospital 20 km/h), then weather-adjusted.
- **Dispatch card and caller SMS.** Summary, responder note and a short reassuring SMS in the caller's language.
- **Duplicate detection.** A call within 300 m and 45 minutes of an open incident is flagged with the other incident's id, distance and age.
- **Voice.** Speech input (en-IN, hi-IN, mr-IN) and read-aloud for follow-up questions, the SMS and safety steps.
- **Replay mode.** Completed runs are cached by message in `data/replay.json`. Tick **replay cached** to replay one in about three seconds, or rely on it as the automatic fallback when a live call fails.
- **Provenance labels.** `FACT`, `MAP DATA`, `AI ESTIMATE`, `COMPUTED` and `ASSUMPTION` appear next to values throughout.
- **Confidence gauge.** A ring computed from the circle radius: tight, moderate or wide.
- **Demo presets.** Fire in Dadar, medical in Bandra, and a deliberately vague accident in Andheri.

### Dispatcher console

`/dispatch`

- **Live queue.** Open tickets as cards showing priority, id, status, incident type and severity, summary, response timer, owner and flags. Refreshes every four seconds.
- **Filters.** All, Mine, Escalated, Overdue.
- **Metric tiles.** Incident type, fastest ETA, circle radius, units found.
- **Live map.** Leaflet on OpenStreetMap: landmark candidates, the incident pin and uncertainty circle, dashed lines to nearby units, and the moving dispatched unit.
- **Tabs.** *Reasoning* (the live trace), *Units* (distance, ETA and a Dispatch button for each), *Dispatch card* (summary, needs, SMS) and *Grounding* (pass or fail checks).
- **One-click dispatch.** The unit goes en route, the incident moves to Dispatched, and a marker travels to the scene on a simulated clock at 8× speed (a four-minute ETA plays out in about thirty seconds). When every unit has arrived the incident moves to On scene by itself.
- **Double-booking guard.** A unit on an open incident cannot be assigned to another; the server refuses with a clear message.
- **Roles.** Control Room, Fire Brigade, Police, Ambulance and Citizen. The chosen role moves its own unit type to the top of the list.
- **Side panels.** Ticket, weather at the scene, a compact outlook, location confidence and the follow-up questions with a reply box.
- **Duplicate banner** with an *Open it* button.
- **Progress ticks** for Locate, Units and Dispatch, with the elapsed time of the run.

### Ticketing

Every incident is a ticket.

| | |
|---|---|
| **Priority** | P1 to P4, set from severity (5 → P1, 4 → P2, 3 → P3, otherwise P4) and adjustable by the operator. |
| **Response target** | Time to first dispatch: **P1 2 min, P2 5 min, P3 10 min, P4 30 min**. A live countdown turns amber and then shows how overdue the ticket is. Each ticket records whether the target was met or missed. |
| **Owner** | Enter your name once; **Take ticket**, **Take over** or **Release**. The queue can filter to your tickets. |
| **Flags** | Fourteen flags, set by hand or automatically (below). |
| **Escalation** | One click raises priority a level (down to P1), adds *Escalated* and *Needs supervisor*, and logs it. |
| **Notes and activity log** | Operator notes plus an automatic entry for every status change, flag, owner change, priority change, dispatched unit, escalation and closure, with who and when. |
| **Resolution codes** | A ticket cannot be closed without an outcome: *Resolved on scene, Patient transported, Handed over to another agency, False alarm, Prank or abusive call, Duplicate of another incident, Caller cancelled, Caller unreachable*, plus an optional note. The server enforces it. |
| **Ordering** | By priority, then least time left on the response target. |

| Set by the operator | Set automatically (operators can clear them) |
|---|---|
| Vulnerable person · Mass casualty · Hazmat or gas · Needs callback · Language support · Media or VIP · Suspected prank · Needs supervisor | Low-confidence location · Possible duplicate · GPS mismatch · Weather delay · Citizen report · Escalated |

### Incident records

- **`/incidents`**: every located incident with severity and status chips, average severity, average fastest ETA, and a hotspot map where marker size scales with severity.
- **`/incidents/[id]`**: the full record. Map with units, the caller's message (and device GPS if shared), the dispatch card, assigned units and their status, grounding checks, and a Ticket section with owner, response-target result, outcome, flags and the complete activity log.

### Citizen app

Available in **English, हिन्दी and मराठी**.

- **Report** (`/report`). Mobile-first. Quick-pick type (Fire, Medical, Accident, Crime or threat, Flooding) starts the message; voice input; **Share my location**; live weather; shortcuts to Nearby and Help.
- **Medical info card.** Name, blood group, allergies and conditions are stored only on the person's phone and included in a report only when they tick the box.
- **Track** (`/track/[id]`). A plain-language status with a live "help is about N minutes away" countdown, a map with their pin and the approaching unit, a progress list (Report received, Help dispatched, Help has arrived, Resolved) and the SMS written for them. Updates every three seconds from a limited public endpoint.
- **Safety steps while you wait.** First-response guidance for fire, medical, accident, crime and other emergencies in all three languages, with read-aloud. The text is fixed and curated, never generated.
- **Tell family.** One-tap WhatsApp share with the tracking link and the incident location, and a copy-link button.
- **Nearby help** (`/nearby`). The nearest hospitals, police stations and fire stations with distance, a map, **Directions** links and a **Call 112** button. Includes a demo location in Dadar. Mumbai only.
- **Helplines and safety guides** (`/help`). Tap-to-call 112, 100, 101, 108, 1916 (BMC disaster control), 181, 1098 and 1930, plus the four safety guides.
- **Installable.** Web app manifest and icon (starts at `/report`) and an offline banner when the connection drops.
- **Language everywhere.** The chosen language sets the interface, the SMS and the read-aloud voice.

### Outlook

`/forecast`

A relative-risk view of the next 24 hours. Risk is expressed as a multiple of a typical hour (1.0× is typical) with four levels: normal, elevated, high, severe.

- **Five categories.** Road accidents, medical, fire, crime and threats, waterlogging.
- **Three inputs.**
  1. The real hourly weather forecast from Open-Meteo: rain, wind, gusts, heat index, humidity.
  2. Time-of-day patterns: rush hours, evening cooking and electrical load, late-night pattern.
  3. Your own incident history, blended into the hourly pattern per category as it accumulates (weight = incidents ÷ 40, capped at 70%, shown on the page).
- **Weather effects.** Wet roads and fog raise accident risk, heat stress raises medical risk, strong wind and dry air raise fire risk, and rain intensity plus the last three hours of rainfall drive waterlogging.
- **Views.** "Next 6 hours" cards, an hour-by-hour risk strip (hover for the reasons) with rain and feels-like rows, rule-based **readiness suggestions** tagged by what they rest on, and a short **AI briefing** written from the computed numbers only.
- **Hotspots.** Past clustering on a roughly 2 km grid, shown once at least eight located incidents exist.
- **Transparency.** The page states how much history the model has seen and how much weight it carries.
- A compact outlook card also sits on the dispatch page.

### Weather intelligence

- **Open-Meteo** conditions for any point in Mumbai, cached for five minutes per roughly 1 km cell.
- **Weather card** on the dispatch and report pages: temperature, feels-like, wind speed and the direction it blows toward, humidity and rain. Refreshes every five minutes.
- **ETA impact.** Light rain adds 10%, moderate rain 25%, heavy rain or thunderstorm 50%, fog 15%.
- **Responder notes.** Wind-driven fire and smoke spread, gust warnings, heat stress and extreme-heat guidance, waterlogging alerts.
- Conditions feed the dispatch card text and set the automatic *Weather delay* flag.

### Admin

`/admin`, password protected.

- **Metrics.** Total, last 24 hours, open, average severity, average fastest ETA, low-confidence count.
- **Breakdowns.** By status, type and source.
- **Ticket analytics.** Response-target compliance, average time to dispatch, overdue now, escalated, open and unassigned, plus charts of priorities, flags in use and outcomes.
- **System health.** Storage backend, ticket storage, AI key, units loaded, limits.
- **Incident management.** A table with a status selector per row, a link to the full record, and delete with a confirm step.
- **Export.** CSV of every incident.
- **Maintenance.** Clear the replay cache or the map-lookup cache (with confirm).
- Refreshes every eight seconds.

### Storage

- **Supabase** when `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, otherwise a **local JSON file** (`data/incidents.json`) so the app runs with no setup.
- The service-role key stays on the server. Row Level Security is on with no public policies, so the public key cannot read incident data.
- **Tickets** live in a `ticket` jsonb column added by `supabase/migrations/002_ticket.sql`. Until that column exists the app carries on: incidents save, a default ticket is derived, status and dispatch changes succeed with a visible warning, and only ticket-only edits are refused, with instructions.
- Incident ids are random (`INC-XXXXXXXX`) and double as an unguessable link for citizens.
- A storage problem never breaks a live call.

### Security and privacy

- **Input limits.** Messages are capped at 600 characters and empty input is rejected.
- **Rate limits.** Ten live calls per minute per IP (replay is exempt); five sign-in attempts per minute per IP.
- **Admin sessions.** Password from the environment, an HMAC-signed `httpOnly`, `sameSite=strict` cookie (secure in production), constant-time comparison. With no password set the panel stays off.
- **Staff-only incident API.** Listing and editing incidents needs an admin or staff session. Open in local development when `STAFF_PASSWORD` is unset, closed in production unless configured.
- **Limited citizen endpoint.** `/api/track/[id]` returns only status, pin, assigned units, the caller SMS and the incident type: never other callers' messages, GPS, tickets or notes.
- **Medical card** stays on the device and is opt-in per report.
- **Secrets** come from the environment and are git-ignored.
- **No false certainty.** Provenance labels, grounding checks, low-confidence flags and plain wording about estimates throughout.

### Design

- **Sunny glass interface.** A bright sky backdrop with a softly breathing sun, slow rays and drifting clouds behind frosted glass cards. Animation stops for users who prefer reduced motion.
- **Typography.** Overpass for headings, Public Sans for body text, Overpass Mono for numbers and labels, Hind for Devanagari.
- **Responsive.** Mobile-first citizen pages, a sticky navigation bar with a live status dot, and a language picker (English, हिन्दी, मराठी) in the header.
- **Remembered preferences.** Role, language and operator name are kept in the browser.

---

## Pages and API

### Pages

| Route | Audience | What it does |
|---|---|---|
| `/` | everyone | Choose role and language |
| `/dispatch` | staff | Live queue, locator, map, ticket panel, weather, outlook |
| `/incidents` | staff | Incident log and hotspot map |
| `/incidents/[id]` | staff | Full record with ticket and activity log |
| `/forecast` | everyone | 24-hour relative-risk outlook |
| `/report` | citizens | Report an emergency with voice, GPS and medical card |
| `/track/[id]` | citizens | Live status, ETA countdown, safety steps |
| `/nearby` | citizens | Nearest hospitals, police stations, fire stations |
| `/help` | citizens | Helplines and safety guides |
| `/admin` | admin | Operations panel |
| `/how` | everyone | How it works, labels and limits |

### API

| Endpoint | Method | Access | Purpose |
|---|---|---|---|
| `/api/locate` | POST | public, rate limited | Run the locator; streams steps as server-sent events |
| `/api/incidents` | GET | staff | List incidents |
| `/api/incidents/[id]` | GET, PATCH | staff | Read; change status, assign a unit, apply ticket actions |
| `/api/track/[id]` | GET | public by id | Limited citizen tracking view |
| `/api/nearby` | GET | public | Nearest units for a point in Mumbai |
| `/api/weather` | GET | public | Conditions and impact for a point in Mumbai |
| `/api/forecast` | GET | public | 24-hour outlook (`?brief=1` adds the AI briefing) |
| `/api/staff/login`, `/logout` | POST | public | Staff session |
| `/api/admin/login`, `/logout` | POST | public | Admin session |
| `/api/admin/overview` | GET | admin | Stats, ticket analytics, health, incident table |
| `/api/admin/export` | GET | admin | CSV export |
| `/api/admin/incidents/[id]` | DELETE | admin | Delete an incident |
| `/api/admin/cache` | POST | admin | Clear the replay or map-lookup cache |

---

## Quick start

Requires Node.js 20 or newer and an Anthropic API key with access to the Opus 5.5 and Sonnet 5.5 models.

```bash
npm install
cp .env.example .env.local     # fill in the values below
npm run dev                    # http://localhost:3000
```

Production: `npm run build && npm start`.

If styles look stale in development, stop the server, delete `.next` and start again.

**Supabase (optional).** Create a project, then in the SQL Editor run `supabase/schema.sql` followed by `supabase/migrations/002_ticket.sql`, which adds a single column: `alter table public.incidents add column if not exists ticket jsonb;`. Put the project URL and the secret service-role key in `.env.local`. Never expose that key to the browser or commit it.

**Staff access in production.** The incident API is closed to the public. Set `ADMIN_PASSWORD` (and optionally `STAFF_PASSWORD`). An admin session also grants staff access, so sign in once at `/admin` and then use the console.

---

## Configuration

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | Locator, dispatch cards and the outlook briefing (server-side only) |
| `ADMIN_PASSWORD` | for `/admin` | Enables the admin panel and grants staff access |
| `STAFF_PASSWORD` | optional | Separate password for dispatchers |
| `SUPABASE_URL` | optional | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | optional | Supabase secret key, server-side only |

Tunable constants: rate limits (`lib/ratelimit.ts`, `app/api/locate/route.ts`), simulation speed and status labels (`lib/sim.ts`), response targets, flags and outcomes (`lib/ticket.ts`), hourly patterns and weather multipliers (`lib/forecast.ts`, `lib/weather.ts`), ETA speeds (`lib/geo.ts`).

---

## Project layout

```
app/
  page.tsx                  role and language
  dispatch/                 dispatcher console
  incidents/  [id]/         incident log and record
  forecast/                 24-hour outlook
  report/  track/[id]/      citizen report and tracking
  nearby/  help/            nearby help, helplines, safety guides
  admin/                    operations panel
  how/                      how it works
  api/                      locate, incidents, track, nearby, weather, forecast, staff, admin
  manifest.ts  icon.svg     installable app
components/                 KidharProvider, MapView, TicketPanel, WeatherCard, ForecastCard,
                            SafetySteps, IncidentMap, NavBar, Backdrop, ui
lib/                        geo, geocode, weather, forecast, ticket, store, safety, i18n,
                            sim, ratelimit, adminAuth
data/                       units.json, geocache.json, replay.json
supabase/                   schema.sql, migrations/002_ticket.sql
```

---

## Data sources

- **Map data and geocoding:** © OpenStreetMap contributors (ODbL), via the public Nominatim service. Lookups are throttled to one per second, identified with a User-Agent and cached. For heavy use, move to a self-hosted or commercial geocoder.
- **Weather:** Open-Meteo.
- **Hospitals, police stations and fire stations:** extracted from OpenStreetMap through the Overpass API.

---

## Scope and status

Kidhar? is a working prototype. It is not connected to 112 or to a live control room, ETAs are estimates rather than live traffic, unit movement is simulated, and the outlook is a relative-risk view that sharpens as incident history grows. Translations, first-aid wording and helpline numbers should be reviewed locally before real-world use. In a real emergency, call **112**.

---

## Roadmap

- Staff sign-in screen with per-role access through Supabase Auth
- Realtime updates in place of polling
- New-incident sound alert, keyboard shortcuts, printable incident report, search and filters on the incident log
- Caller SMS through a messaging provider, after dispatcher confirmation
- A commercial places API for better landmark lookup, and a backtest of the outlook
- Offline service worker for the safety guides, automated tests for the distance, weather and risk rules, and a hosted deployment
