import { getChatGPTUser } from "../../chatgpt-auth";
import { authorizeAdmin } from "../../../db/admin";
import { hitRate } from "../../../db/runtime";

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { allowed, db } = await authorizeAdmin(user);
  if (!allowed) return Response.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json() as Record<string, unknown>;
  const assessmentId = String(body.assessmentId ?? "");
  const assessment = await db.prepare("SELECT annual_usage_kwh, panel_count, annual_generation_kwh, annual_bill_before, annual_bill_solar_battery, annual_benefit FROM assessments WHERE id = ?").bind(assessmentId).first<Record<string, number>>();
  if (!assessment) return Response.json({ error: "Assessment not found." }, { status: 404 });
  const pylonUsage = Number(body.pylonAnnualUsageKwh), pylonPanels = Number(body.pylonPanelCount), pylonGeneration = Number(body.pylonGenerationKwh), pylonBefore = Number(body.pylonBillBefore), pylonAfter = Number(body.pylonBillAfter);
  if (![pylonUsage, pylonPanels, pylonGeneration, pylonBefore, pylonAfter].every(Number.isFinite) || pylonUsage <= 0 || pylonPanels <= 0 || pylonGeneration <= 0) return Response.json({ error: "Enter valid Pylon figures." }, { status: 400 });
  const usageHit = hitRate(assessment.annual_usage_kwh, pylonUsage);
  const panelsHit = hitRate(assessment.panel_count, pylonPanels);
  const inputHit = (usageHit + panelsHit) / 2;
  const generationHit = hitRate(assessment.annual_generation_kwh, pylonGeneration);
  const pylonBenefit = pylonBefore - pylonAfter;
  const benefitHit = hitRate(assessment.annual_benefit, pylonBenefit);
  const overallHit = inputHit * 0.2 + generationHit * 0.4 + benefitHit * 0.4;
  const proposalUrl = String(body.proposalUrl ?? "").slice(0, 500);
  const existing = await db.prepare("SELECT id FROM pylon_comparisons WHERE assessment_id = ? AND proposal_url = ? LIMIT 1")
    .bind(assessmentId, proposalUrl).first<{ id: string }>();
  const id = existing?.id ?? crypto.randomUUID();
  await db.prepare(`INSERT INTO pylon_comparisons (id, assessment_id, proposal_url, pylon_annual_usage_kwh, pylon_panel_count, pylon_generation_kwh, pylon_bill_before, pylon_bill_after, input_hit_rate, generation_hit_rate, benefit_hit_rate, overall_hit_rate) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(assessment_id, proposal_url) DO UPDATE SET pylon_annual_usage_kwh=excluded.pylon_annual_usage_kwh, pylon_panel_count=excluded.pylon_panel_count, pylon_generation_kwh=excluded.pylon_generation_kwh, pylon_bill_before=excluded.pylon_bill_before, pylon_bill_after=excluded.pylon_bill_after, input_hit_rate=excluded.input_hit_rate, generation_hit_rate=excluded.generation_hit_rate, benefit_hit_rate=excluded.benefit_hit_rate, overall_hit_rate=excluded.overall_hit_rate, created_at=CURRENT_TIMESTAMP`)
    .bind(id, assessmentId, proposalUrl, pylonUsage, pylonPanels, pylonGeneration, pylonBefore, pylonAfter, inputHit, generationHit, benefitHit, overallHit).run();
  return Response.json({ id, inputHit, generationHit, benefitHit, overallHit }, { status: existing ? 200 : 201 });
}
