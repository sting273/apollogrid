import { providerSecret } from "../../../../db/provider-config";
import { getD1 } from "../../../../db/runtime";

type Assessment = { id:string; postcode:string; address:string; annual_usage_kwh:number; usage_source:string; panel_count:number; panel_watts:number; system_kwp:number; annual_generation_kwh:number; annual_bill_before:number; annual_bill_solar_only:number; annual_bill_solar_battery:number; annual_benefit:number; created_at:string };
type Lead = { id:string; assessment_id:string|null; customer_name:string; phone:string; email:string; preferred_time:string; consent:number; created_at:string };
type Comparison = { id:string; assessment_id:string; proposal_url:string; pylon_annual_usage_kwh:number; pylon_panel_count:number; pylon_generation_kwh:number; pylon_bill_before:number; pylon_bill_after:number; input_hit_rate:number; generation_hit_rate:number; benefit_hit_rate:number; overall_hit_rate:number; created_at:string };
type ApiUsage = { id:string; provider:string; endpoint:string; status_code:number; success:number; created_at:string };

type ImportPayload = { assessments?: Assessment[]; leads?: Lead[]; comparisons?: Comparison[]; apiUsage?: ApiUsage[] };
const list = <T>(value: unknown): T[] => Array.isArray(value) && value.length <= 250 ? value as T[] : [];

export async function POST(request: Request) {
  const token = providerSecret("MIGRATION_TOKEN", process.env.MIGRATION_TOKEN);
  if (!token || request.headers.get("x-apollogrid-migration-token") !== token) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const body = await request.json() as ImportPayload;
  const assessments = list<Assessment>(body.assessments);
  const leads = list<Lead>(body.leads);
  const comparisons = list<Comparison>(body.comparisons);
  const apiUsage = list<ApiUsage>(body.apiUsage);
  if (!assessments.length && !leads.length && !comparisons.length && !apiUsage.length) {
    return Response.json({ error: "No records supplied." }, { status: 400 });
  }

  const db = getD1();
  const statements = [
    ...assessments.map((row) => db.prepare("INSERT INTO assessments (id,postcode,address,annual_usage_kwh,usage_source,panel_count,panel_watts,system_kwp,annual_generation_kwh,annual_bill_before,annual_bill_solar_only,annual_bill_solar_battery,annual_benefit,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(row.id,row.postcode,row.address,row.annual_usage_kwh,row.usage_source,row.panel_count,row.panel_watts,row.system_kwp,row.annual_generation_kwh,row.annual_bill_before,row.annual_bill_solar_only,row.annual_bill_solar_battery,row.annual_benefit,row.created_at)),
    ...leads.map((row) => db.prepare("INSERT INTO leads (id,assessment_id,customer_name,phone,email,preferred_time,consent,created_at) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(row.id,row.assessment_id,row.customer_name,row.phone,row.email,row.preferred_time,row.consent,row.created_at)),
    ...comparisons.map((row) => db.prepare("INSERT INTO pylon_comparisons (id,assessment_id,proposal_url,pylon_annual_usage_kwh,pylon_panel_count,pylon_generation_kwh,pylon_bill_before,pylon_bill_after,input_hit_rate,generation_hit_rate,benefit_hit_rate,overall_hit_rate,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(assessment_id,proposal_url) DO NOTHING").bind(row.id,row.assessment_id,row.proposal_url,row.pylon_annual_usage_kwh,row.pylon_panel_count,row.pylon_generation_kwh,row.pylon_bill_before,row.pylon_bill_after,row.input_hit_rate,row.generation_hit_rate,row.benefit_hit_rate,row.overall_hit_rate,row.created_at)),
    ...apiUsage.map((row) => db.prepare("INSERT INTO api_usage_events (id,provider,endpoint,status_code,success,created_at) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(row.id,row.provider,row.endpoint,row.status_code,row.success,row.created_at)),
  ];
  await db.batch(statements);
  return Response.json({ imported: { assessments: assessments.length, leads: leads.length, comparisons: comparisons.length, apiUsage: apiUsage.length } });
}
