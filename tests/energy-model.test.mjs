import assert from "node:assert/strict";
import test from "node:test";
import { ENERGY_MODEL, buildThirtyYearProjection, simulateEnergy } from "../app/energyModel.ts";

test("half-hour model applies the conservative delivered-energy factor", () => {
  const result = simulateEnergy({ annualUsageKwh: 4181.116, annualGenerationKwh: 3583.37 * ENERGY_MODEL.deliveredEnergyFactor });
  const solarOnly = simulateEnergy({ annualUsageKwh: 4181.116, annualGenerationKwh: 3583.37 * ENERGY_MODEL.deliveredEnergyFactor, batteryEnabled: false });

  assert.equal(result.monthly.length, 12);
  assert.equal(ENERGY_MODEL.deliveredEnergyFactor, 0.9);
  assert.ok(result.annualBillBefore > 1100 && result.annualBillBefore < 1250);
  assert.ok(result.annualBillAfter > 130 && result.annualBillAfter < 145);
  assert.ok(result.annualBillAfter < result.annualBillBefore);
  assert.ok(result.batteryGridChargeKwh > 0);
  assert.ok(result.batteryToHomeKwh > 0);
  assert.ok(result.batteryGridToHomeKwh > result.batterySolarToHomeKwh);
  assert.equal(solarOnly.batteryToHomeKwh, 0);
  assert.ok(solarOnly.annualBillAfter > result.annualBillAfter);
  assert.ok(result.exportKwh > 0);
  assert.ok(result.solarSelfUseRate > 0 && result.solarSelfUseRate < 100);
  assert.ok(result.monthly.some((month) => month.after < 0));
  assert.equal(ENERGY_MODEL.offPeakEndHour, 7);
});

test("thirty-year projection applies inflation and solar degradation", () => {
  const projection = buildThirtyYearProjection(4181.116, 3583.37);

  assert.equal(projection.length, 30);
  assert.ok(projection[29].before > projection[0].before);
  assert.ok(projection.every((point) => point.solarOnly < point.before));
  assert.ok(projection.every((point) => point.solarBattery < point.solarOnly));
});
