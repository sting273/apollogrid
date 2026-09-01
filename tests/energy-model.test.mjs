import assert from "node:assert/strict";
import test from "node:test";
import { ENERGY_MODEL, buildThirtyYearProjection, simulateEnergy } from "../app/energyModel.ts";

test("half-hour model reproduces the Pylon-style annual energy flow", () => {
  const result = simulateEnergy({ annualUsageKwh: 4181.116, annualGenerationKwh: 3583.37 });

  assert.equal(result.monthly.length, 12);
  assert.ok(result.annualBillBefore > 1100 && result.annualBillBefore < 1250);
  assert.ok(result.annualBillAfter < result.annualBillBefore);
  assert.ok(result.batteryGridChargeKwh > 0);
  assert.ok(result.batteryToHomeKwh > 0);
  assert.ok(result.exportKwh > 0);
  assert.ok(result.solarSelfUseRate > 0 && result.solarSelfUseRate < 100);
  assert.ok(result.monthly.some((month) => month.after < 0));
  assert.equal(ENERGY_MODEL.offPeakEndHour, 7);
});

test("thirty-year projection applies inflation and solar degradation", () => {
  const projection = buildThirtyYearProjection(4181.116, 3583.37);

  assert.equal(projection.length, 30);
  assert.ok(projection[29].before > projection[0].before);
  assert.ok(projection.every((point) => point.after < point.before));
});
