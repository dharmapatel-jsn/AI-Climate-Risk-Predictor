# AI Climate Risk Predictor

This is my full-stack climate intelligence project focused on one practical goal: identify high-risk zones early enough to trigger action.

The dashboard predicts short-term risk for:

- Flooding
- Heatwaves
- Air pollution spikes

It combines open weather signals, a transparent scoring engine, and map-based risk visualization so the output is both technical and easy to explain.

## What I Built

- A Next.js 16 + TypeScript application with App Router
- Deterministic risk scoring engine using transparent formulas
- Leaflet risk map with zone overlays and color-coded severity
- Client-side alert generation for high-risk events
- Global zone seeding that includes country capitals and major cities worldwide

## Why This Project Exists

Climate risk is becoming a planning problem, not only a research topic. I built this as a base for city-level and district-level monitoring workflows where teams need actionable signals, not raw weather numbers.

## Stack

- Next.js 16
- TypeScript
- Tailwind CSS 4
- Leaflet + react-leaflet
- Open-Meteo (current weather data)

## Data Sources

- Open-Meteo forecast API for temperature, precipitation, humidity, wind, and precipitation probability
- Open-Meteo air-quality API for PM2.5 (`pm2_5`) when available
- Deterministic PM2.5 fallback estimate if air-quality feed is temporarily unavailable

## Local Run

```bash
npm install
npm run seed
npm test
npm run dev
```

Open http://localhost:3000

## GitHub Pages

This app is configured as a static export so it can be deployed to GitHub Pages.

- The build outputs to `out/`
- The Pages workflow lives in `.github/workflows/deploy-pages.yml`
- If you deploy under a project repo, the workflow sets the base path automatically from the repository name

## Environment

Copy `.env.example` to `.env.local` and set values as needed.

Available keys:

- `WEATHER_API_KEY`
- `NEXT_PUBLIC_MAP_STYLE_KEY`
- `ALERT_FLOOD_THRESHOLD`
- `ALERT_HEAT_THRESHOLD`
- `ALERT_AIR_THRESHOLD`

## API Surface

- Static-export mode is enabled, so no server API routes are used at runtime.
- The dashboard computes risk data in the browser and fetches weather directly from Open-Meteo.
- Alert cards are generated client-side and are not persisted on static hosting.

## Tests

- Risk utility tests run with Node's built-in test runner through tsx.
- Run: `npm test`

## Global Coverage Data

- Capitals are fetched for all countries from Rest Countries v3.
- Major cities are generated from the all-the-cities dataset.
- Current major-city cutoff is population >= 500,000 globally.
- For USA, Canada, Australia, and Europe, an expanded cutoff of population >= 150,000 is used to include more major cities.
- All cities above the major-city cutoff are included, alongside country capitals.

## Scoring Logic (Current Baseline)

- Flood score: precipitation, rain probability, humidity
- Heat score: temperature, humidity, wind
- Air score: PM2.5 concentration, wind
- Overall score: weighted mix (flood 35%, heat 40%, air 25%)

This version is intentionally explainable. It is designed so I can later swap deterministic formulas with trained models while keeping the same API contract.

## Next Up

1. Add historical climate training data and feature pipelines.
2. Introduce geospatial indexing for dense grid inference.
3. Add user-specific alert delivery (email/SMS/webhook).
4. Add model monitoring and concept drift detection.
