import { ensureSchema } from "../../../db/runtime";

const number = (value: unknown) => Number(value);

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const postcode = String(body.postcode ?? "").trim().toUpperCase();
  const address = String(body.address ?? "").trim();
  const values = {
    annualUsageKwh: number(body.annualUsageKwh), panelCount: number(body.panelCount), panelWatts: number(body.panelWatts),
    systemKwp: number(body.systemKwp), annualGenerationKwh: number(body.annualGenerationKwh), annualBillBefore: number(body.annualBillBefore),
    annualBillSolarOnly: number(body.annualBillSolarOnly), annualBillSolarBattery: number(body.annualBillSolarBattery), annualBenefit: number(body.annualBenefit),
  };
  if (!postcode || !address || Object.values(values).some(value => !Number.isFinite(value)) || values.annualUsageKwh < 1000 || values.annualUsageKwh > 30000 || values.panelCount < 1 || values.panelCount > 60) {
    return Response.json({ error: "Invalid assessment data." }, { status: 400 });
  }
  const requestedId = String(body.id ?? "");
  const id = /^[0-9a-f-]{36}$/i.test(requestedId) ? requestedId : crypto.randomUUID();
  const db = await ensureSchema();
  await db.prepare(`INSERT INTO assessments (id, postcode, address, annual_usage_kwh, usage_source, panel_count, panel_watts, system_kwp, annual_generation_kwh, annual_bill_before, annual_bill_solar_only, annual_bill_solar_battery, annual_benefit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET postcode=excluded.postcode, address=excluded.address, annual_usage_kwh=excluded.annual_usage_kwh, usage_source=excluded.usage_source, panel_count=excluded.panel_count, panel_watts=excluded.panel_watts, system_kwp=excluded.system_kwp, annual_generation_kwh=excluded.annual_generation_kwh, annual_bill_before=excluded.annual_bill_before, annual_bill_solar_only=excluded.annual_bill_solar_only, annual_bill_solar_battery=excluded.annual_bill_solar_battery, annual_benefit=excluded.annual_benefit`)
    .bind(id, postcode, address.slice(0, 300), values.annualUsageKwh, String(body.usageSource ?? "unknown"), values.panelCount, values.panelWatts, values.systemKwp, values.annualGenerationKwh, values.annualBillBefore, values.annualBillSolarOnly, values.annualBillSolarBattery, values.annualBenefit).run();
  return Response.json({ id }, { status: 201 });
}
