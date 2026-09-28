# 🌱 GardenPlan AI

**What to plant, when to plant it, and what to do next.** A 41-plant bank (vegetables, herbs, flowers) with sun/water needs, a planting calendar computed from your last frost date, care reminders, and a harvest tracker — all running 100% in your browser.

## The problem

Seed packets give generic advice, gardening apps want subscriptions, and nobody remembers when they planted the tomatoes or when to fertilize. Timing is everything in a garden, and it's all date math.

## The solution

GardenPlan AI is a single-page web app (no build step, no dependencies, no account) that:

1. **Knows your frost date** — pick your USDA hardiness zone (1–13) for an approximate last-spring-frost date, or override it with your own.
2. **Builds your planting calendar** — 41 plants with indoor-start, transplant, and direct-sow dates computed from your frost date, plus spacing and growing notes. Filter by type or search.
3. **Reminds you what to do** — add plantings and get a 14-day task list: watering on each plant's cadence (low/medium/high needs), fertilizing every 3 weeks for heavy feeders, and harvest-window alerts.
4. **Tracks your harvest** — log yields by planting (qty + unit), see season totals per crop.
5. **One-tap planting** — hit "+ Plant this" on any calendar card to jump straight to the planting form.

Everything persists in `localStorage`. Optional: set `OPENAI_API_KEY` for AI garden advice in a future version — nothing requires it.

## Privacy

**Nothing leaves the device.** No server, no analytics, no tracking. Serve it locally and it works offline.

## Run it

```bash
# any static server works:
npx serve .
# then open http://localhost:3000
```

Set your zone, browse the planting calendar, add a few plantings, and check the 14-day task list.

## Tests

```bash
bash test/smoke.sh   # file presence, JS syntax, core logic spot checks
bash test/e2e.sh     # full flows: frost math, schedules, reminders, harvests, persistence
```

## Note

Frost dates are approximate zone averages for planning — microclimates vary. When in doubt, watch your local forecast.
