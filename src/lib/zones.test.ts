import test from "node:test";
import assert from "node:assert/strict";

import { distanceKm, selectRelevantZones, type SeedZone } from "./zones";

test("distanceKm returns zero for same coordinates", () => {
  const d = distanceKm(12.34, 56.78, 12.34, 56.78);
  assert.equal(d, 0);
});

test("distanceKm is symmetric", () => {
  const ab = distanceKm(40.7128, -74.006, 51.5074, -0.1278);
  const ba = distanceKm(51.5074, -0.1278, 40.7128, -74.006);
  assert.ok(Math.abs(ab - ba) < 1e-9);
});

test("selectRelevantZones applies lower bound when maxZones is small", () => {
  const zones: SeedZone[] = Array.from({ length: 120 }, (_, i) => ({
    id: `z-${i}`,
    name: `Zone ${i}`,
    lat: 10 + i * 0.01,
    lon: 20 + i * 0.01,
    radiusKm: 10,
    countryCode: "XX",
    populationEstimate: 1000 + i,
  }));

  const selected = selectRelevantZones(zones, 10, 20, 10);
  assert.equal(selected.length, 50);
});

test("selectRelevantZones does not exceed source length", () => {
  const zones: SeedZone[] = Array.from({ length: 30 }, (_, i) => ({
    id: `s-${i}`,
    name: `Small ${i}`,
    lat: 0,
    lon: i,
    radiusKm: 8,
    countryCode: "YY",
    populationEstimate: 10_000,
  }));

  const selected = selectRelevantZones(zones, 0, 0, 500);
  assert.equal(selected.length, 30);
});
