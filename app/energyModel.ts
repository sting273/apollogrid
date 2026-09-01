export const ENERGY_MODEL = {
  deliveredEnergyFactor: 0.90,
  dayImportRate: 0.28,
  offPeakImportRate: 0.07,
  exportRate: 0.15,
  standingChargePerDay: 0.50,
  offPeakStartHour: 0,
  offPeakEndHour: 7,
  batteryCapacityKwh: 10.24,
  batteryPowerKw: 5.12,
  batteryRoundTripEfficiency: 0.95,
  utilityInflation: 0.05,
  firstYearProductionFactor: 0.99,
  annualDegradation: 0.0035,
} as const;

const MONTHS = [
  { name: "Jan", days: 31, solar: 84.8878967782, load: 1.18, daylight: [8.1, 16.0] },
  { name: "Feb", days: 28, solar: 153.3857513349, load: 1.09, daylight: [7.3, 17.1] },
  { name: "Mar", days: 31, solar: 301.7004431628, load: 1.02, daylight: [6.3, 18.1] },
  { name: "Apr", days: 30, solar: 379.8350327809, load: 0.94, daylight: [5.8, 19.9] },
  { name: "May", days: 31, solar: 487.6717282455, load: 0.88, daylight: [5.0, 20.8] },
  { name: "Jun", days: 30, solar: 499.5674474921, load: 0.82, daylight: [4.7, 21.3] },
  { name: "Jul", days: 31, solar: 518.1649043119, load: 0.80, daylight: [4.9, 21.1] },
  { name: "Aug", days: 31, solar: 461.2592043688, load: 0.82, daylight: [5.7, 20.2] },
  { name: "Sep", days: 30, solar: 292.6198452627, load: 0.90, daylight: [6.6, 19.1] },
  { name: "Oct", days: 31, solar: 207.2956107284, load: 0.99, daylight: [7.4, 18.0] },
  { name: "Nov", days: 30, solar: 107.3607741417, load: 1.09, daylight: [7.4, 16.1] },
  { name: "Dec", days: 31, solar: 89.6213613920, load: 1.17, daylight: [8.0, 15.7] },
] as const;

const gaussian = (value: number, centre: number, width: number) => Math.exp(-0.5 * ((value - centre) / width) ** 2);

const LOAD_PROFILE = Array.from({ length: 48 }, (_, slot) => {
  const hour = (slot + 0.5) / 2;
  return 0.42 + 0.55 * gaussian(hour, 7.5, 1.25) + 0.22 * gaussian(hour, 13, 2.8) + 1.15 * gaussian(hour, 19, 2.25);
});

const LOAD_PROFILE_TOTAL = LOAD_PROFILE.reduce((sum, value) => sum + value, 0);
const SOLAR_TOTAL = MONTHS.reduce((sum, month) => sum + month.solar, 0);
const LOAD_MONTH_TOTAL = MONTHS.reduce((sum, month) => sum + month.load, 0);

export type MonthlyEnergyBill = {
  month: string;
  before: number;
  after: number;
  loadKwh: number;
  generationKwh: number;
  exportKwh: number;
  gridImportKwh: number;
};

export type EnergySimulation = {
  monthly: MonthlyEnergyBill[];
  annualBillBefore: number;
  annualBillAfter: number;
  annualBenefit: number;
  billReduction: number;
  generationKwh: number;
  directSolarKwh: number;
  solarToBatteryKwh: number;
  solarSelfConsumedKwh: number;
  solarSelfUseRate: number;
  batteryToHomeKwh: number;
  batteryGridChargeKwh: number;
  exportKwh: number;
  exportIncome: number;
  gridImportKwh: number;
  householdCoverage: number;
  standingCharge: number;
};

export type ProjectionPoint = { year: number; before: number; after: number };

type SimulationOptions = {
  annualUsageKwh: number;
  annualGenerationKwh: number;
  importMultiplier?: number;
  standingMultiplier?: number;
};

export function simulateEnergy({ annualUsageKwh, annualGenerationKwh, importMultiplier = 1, standingMultiplier = 1 }: SimulationOptions): EnergySimulation {
  const chargeEfficiency = Math.sqrt(ENERGY_MODEL.batteryRoundTripEfficiency);
  const dischargeEfficiency = chargeEfficiency;
  const slotPowerKwh = ENERGY_MODEL.batteryPowerKw / 2;
  let batteryKwh = ENERGY_MODEL.batteryCapacityKwh;
  let directSolarKwh = 0;
  let solarToBatteryKwh = 0;
  let batteryToHomeKwh = 0;
  let batteryGridChargeKwh = 0;
  let exportKwh = 0;
  let gridImportKwh = 0;

  const monthly = MONTHS.map((month) => {
    const monthlyLoad = annualUsageKwh * month.load / LOAD_MONTH_TOTAL;
    const monthlySolar = annualGenerationKwh * month.solar / SOLAR_TOTAL;
    const dailyLoad = monthlyLoad / month.days;
    const dailySolar = monthlySolar / month.days;
    const solarWeights = Array.from({ length: 48 }, (_, slot) => {
      const hour = (slot + 0.5) / 2;
      if (hour <= month.daylight[0] || hour >= month.daylight[1]) return 0;
      return Math.sin(Math.PI * (hour - month.daylight[0]) / (month.daylight[1] - month.daylight[0]));
    });
    const solarWeightTotal = solarWeights.reduce((sum, value) => sum + value, 0);
    let beforeCost = 0;
    let afterCost = 0;
    let monthExport = 0;
    let monthGridImport = 0;

    for (let day = 0; day < month.days; day += 1) {
      for (let slot = 0; slot < 48; slot += 1) {
        const hour = (slot + 0.5) / 2;
        const offPeak = hour >= ENERGY_MODEL.offPeakStartHour && hour < ENERGY_MODEL.offPeakEndHour;
        const importRate = (offPeak ? ENERGY_MODEL.offPeakImportRate : ENERGY_MODEL.dayImportRate) * importMultiplier;
        const load = dailyLoad * LOAD_PROFILE[slot] / LOAD_PROFILE_TOTAL;
        const solar = solarWeightTotal ? dailySolar * solarWeights[slot] / solarWeightTotal : 0;
        beforeCost += load * importRate;

        const direct = Math.min(load, solar);
        directSolarKwh += direct;
        let remainingLoad = load - direct;
        let excessSolar = solar - direct;

        if (excessSolar > 0) {
          const storageRoom = ENERGY_MODEL.batteryCapacityKwh - batteryKwh;
          const solarInput = Math.min(excessSolar, slotPowerKwh, storageRoom / chargeEfficiency);
          batteryKwh += solarInput * chargeEfficiency;
          solarToBatteryKwh += solarInput;
          excessSolar -= solarInput;
          exportKwh += excessSolar;
          monthExport += excessSolar;
        }

        if (remainingLoad > 0 && !offPeak) {
          const dischargeToHome = Math.min(remainingLoad, slotPowerKwh, batteryKwh * dischargeEfficiency);
          batteryKwh -= dischargeToHome / dischargeEfficiency;
          batteryToHomeKwh += dischargeToHome;
          remainingLoad -= dischargeToHome;
        }

        let intervalGridImport = remainingLoad;
        if (offPeak && batteryKwh < ENERGY_MODEL.batteryCapacityKwh) {
          const storageRoom = ENERGY_MODEL.batteryCapacityKwh - batteryKwh;
          const gridCharge = Math.min(slotPowerKwh, storageRoom / chargeEfficiency);
          batteryKwh += gridCharge * chargeEfficiency;
          intervalGridImport += gridCharge;
          batteryGridChargeKwh += gridCharge;
        }

        gridImportKwh += intervalGridImport;
        monthGridImport += intervalGridImport;
        afterCost += intervalGridImport * importRate - excessSolar * ENERGY_MODEL.exportRate;
      }
    }

    const standing = month.days * ENERGY_MODEL.standingChargePerDay * standingMultiplier;
    return {
      month: month.name,
      before: beforeCost + standing,
      after: afterCost + standing,
      loadKwh: monthlyLoad,
      generationKwh: monthlySolar,
      exportKwh: monthExport,
      gridImportKwh: monthGridImport,
    };
  });

  const annualBillBefore = monthly.reduce((sum, month) => sum + month.before, 0);
  const annualBillAfter = monthly.reduce((sum, month) => sum + month.after, 0);
  const solarSelfConsumedKwh = directSolarKwh + solarToBatteryKwh;
  const annualBenefit = annualBillBefore - annualBillAfter;

  return {
    monthly,
    annualBillBefore,
    annualBillAfter,
    annualBenefit,
    billReduction: annualBillBefore > 0 ? annualBenefit / annualBillBefore * 100 : 0,
    generationKwh: annualGenerationKwh,
    directSolarKwh,
    solarToBatteryKwh,
    solarSelfConsumedKwh,
    solarSelfUseRate: annualGenerationKwh > 0 ? solarSelfConsumedKwh / annualGenerationKwh * 100 : 0,
    batteryToHomeKwh,
    batteryGridChargeKwh,
    exportKwh,
    exportIncome: exportKwh * ENERGY_MODEL.exportRate,
    gridImportKwh,
    householdCoverage: annualUsageKwh > 0 ? Math.min((directSolarKwh + batteryToHomeKwh) / annualUsageKwh * 100, 100) : 0,
    standingCharge: 365 * ENERGY_MODEL.standingChargePerDay,
  };
}

export function buildThirtyYearProjection(annualUsageKwh: number, annualGenerationKwh: number): ProjectionPoint[] {
  return Array.from({ length: 30 }, (_, index) => {
    const productionFactor = index === 0 ? 1 : Math.max(ENERGY_MODEL.firstYearProductionFactor - ENERGY_MODEL.annualDegradation * (index - 1), 0);
    const inflationMultiplier = (1 + ENERGY_MODEL.utilityInflation) ** index;
    const result = simulateEnergy({
      annualUsageKwh,
      annualGenerationKwh: annualGenerationKwh * productionFactor,
      importMultiplier: inflationMultiplier,
      standingMultiplier: inflationMultiplier,
    });
    return { year: index + 1, before: result.annualBillBefore, after: result.annualBillAfter };
  });
}
