import test from "node:test";
import assert from "node:assert/strict";

import {
  computeRiskBreakdown,
  overallScoreFromBreakdown,
  rationaleFromBreakdown,
  riskLevelFromScore,
} from "./risk-utils";

test("risk level thresholds map correctly", () => {
  assert.equal(riskLevelFromScore(0.2), "low");
  assert.equal(riskLevelFromScore(0.3999), "low");
  assert.equal(riskLevelFromScore(0.4), "moderate");
  assert.equal(riskLevelFromScore(0.6499), "moderate");
  assert.equal(riskLevelFromScore(0.65), "high");
  assert.equal(riskLevelFromScore(0.8499), "high");
  assert.equal(riskLevelFromScore(0.85), "extreme");
});

test("risk breakdown stays bounded and increases for severe weather", () => {
  const mild = computeRiskBreakdown({
    temperature2m: 24,
    precipitation: 0,
    precipitationProbability: 5,
    windSpeed10m: 2,
    humidity: 45,
    pm25Estimate: 10,
  });

  const severe = computeRiskBreakdown({
    temperature2m: 42,
    precipitation: 40,
    precipitationProbability: 95,
    windSpeed10m: 7,
    humidity: 88,
    pm25Estimate: 100,
  });

  for (const score of Object.values(mild)) {
    assert.ok(score >= 0 && score <= 1);
  }

  for (const score of Object.values(severe)) {
    assert.ok(score >= 0 && score <= 1);
  }

  assert.ok(severe.flood > mild.flood);
  assert.ok(severe.heatwave > mild.heatwave);
  assert.ok(severe.airQuality > mild.airQuality);
});

test("overall score uses expected weighting", () => {
  const overall = overallScoreFromBreakdown({
    flood: 0.8,
    heatwave: 0.6,
    airQuality: 0.4,
  });

  assert.equal(overall, 0.62);
});

test("overall score is clamped when breakdown values are out of bounds", () => {
  const high = overallScoreFromBreakdown({
    flood: 2,
    heatwave: 2,
    airQuality: 2,
  });

  const low = overallScoreFromBreakdown({
    flood: -1,
    heatwave: -0.2,
    airQuality: -8,
  });

  assert.equal(high, 1);
  assert.equal(low, 0);
});

test("rationale includes category-specific notes and low-risk fallback", () => {
  const severeNotes = rationaleFromBreakdown({
    flood: 0.8,
    heatwave: 0.7,
    airQuality: 0.66,
  });

  assert.ok(severeNotes.some((line) => line.includes("flood exposure")));
  assert.ok(severeNotes.some((line) => line.includes("heat stress")));
  assert.ok(severeNotes.some((line) => line.includes("PM2.5")));

  const fallbackNotes = rationaleFromBreakdown({
    flood: 0.2,
    heatwave: 0.3,
    airQuality: 0.1,
  });

  assert.deepEqual(fallbackNotes, ["Current conditions indicate manageable risk levels."]);
});

test("risk breakdown remains bounded for unrealistic weather values", () => {
  const extreme = computeRiskBreakdown({
    temperature2m: 120,
    precipitation: 500,
    precipitationProbability: 200,
    windSpeed10m: -10,
    humidity: 250,
    pm25Estimate: -50,
  });

  assert.ok(extreme.flood >= 0 && extreme.flood <= 1);
  assert.ok(extreme.heatwave >= 0 && extreme.heatwave <= 1);
  assert.ok(extreme.airQuality >= 0 && extreme.airQuality <= 1);
});
