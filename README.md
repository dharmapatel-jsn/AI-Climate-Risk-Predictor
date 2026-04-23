# AI Climate Risk Predictor

This is my full-stack climate intelligence project focused on one practical goal: identify high-risk zones early enough to trigger action.

The dashboard predicts short-term risk for:

- Flooding
- Heatwaves
- Air pollution spikes

It combines open weather signals, a transparent scoring engine, and map-based risk visualization so the output is both technical and easy to explain.

## What I Built

- A Next.js 16 + TypeScript application with App Router
- Risk scoring API using deterministic, explainable formulas
- Leaflet risk map with zone overlays and color-coded severity
- Alert pipeline that writes high-risk events to local persistence
- Seeded geographies for rapid demo and testing

## Why This Project Exists

Climate risk is becoming a planning problem, not only a research topic. I built this as a base for city-level and district-level monitoring workflows where teams need actionable signals, not raw weather numbers.

## Stack

- Next.js 16
- TypeScript
- Tailwind CSS 4
- Leaflet + react-leaflet
- Open-Meteo (current weather data)

## Local Run

```bash
npm install
npm run seed
npm run dev
```

Open http://localhost:3000

## Environment

Copy `.env.example` to `.env.local` and set values as needed.

Available keys:

- `WEATHER_API_KEY`
- `NEXT_PUBLIC_MAP_STYLE_KEY`
- `ALERT_FLOOD_THRESHOLD`
- `ALERT_HEAT_THRESHOLD`
- `ALERT_AIR_THRESHOLD`

## API Surface

- `GET /api/risk?lat=<number>&lon=<number>`
  - Scores every configured zone against current conditions
  - Generates alert records when thresholds are crossed
- `GET /api/alerts`
  - Returns latest alert entries from local store

## Scoring Logic (Current Baseline)

- Flood score: precipitation, rain probability, humidity
- Heat score: temperature, humidity, wind
- Air score: PM2.5 proxy, wind
- Overall score: weighted mix (flood 35%, heat 40%, air 25%)

This version is intentionally explainable. It is designed so I can later swap deterministic formulas with trained models while keeping the same API contract.

## Next Up

1. Replace PM2.5 proxy with real pollutant feeds.
2. Add historical climate training data and feature pipelines.
3. Introduce geospatial indexing for dense grid inference.
4. Add user-specific alert delivery (email/SMS/webhook).
5. Add model monitoring and concept drift detection.
