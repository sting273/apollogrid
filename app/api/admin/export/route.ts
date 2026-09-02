import { getChatGPTUser } from "../../../chatgpt-auth";
import { authorizeAdmin } from "../../../../db/admin";

const xml = (value: unknown) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cell = (value: unknown, numeric = false) => `<Cell><Data ss:Type="${numeric ? "Number" : "String"}">${xml(value)}</Data></Cell>`;
function sheet(name: string, headers: string[], rows: Array<Array<{ value: unknown; numeric?: boolean }>>) {
  return `<Worksheet ss:Name="${xml(name)}"><Table><Row ss:StyleID="header">${headers.map(value => cell(value)).join("")}</Row>${rows.map(row => `<Row>${row.map(item => cell(item.value, item.numeric)).join("")}</Row>`).join("")}</Table><WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane></WorksheetOptions></Worksheet>`;
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { allowed, db } = await authorizeAdmin(user);
  if (!allowed) return Response.json({ error: "Admin access required." }, { status: 403 });
  const [assessments, leads, comparisons, apiUsage] = await Promise.all([
    db.prepare("SELECT * FROM assessments ORDER BY created_at DESC").all<Record<string, unknown>>(),
    db.prepare("SELECT l.*, a.address, a.postcode FROM leads l LEFT JOIN assessments a ON a.id=l.assessment_id ORDER BY l.created_at DESC").all<Record<string, unknown>>(),
    db.prepare("SELECT p.*, a.address, a.postcode, a.annual_usage_kwh our_usage_kwh, a.panel_count our_panel_count, a.annual_generation_kwh our_generation_kwh, a.annual_bill_before our_bill_before, a.annual_bill_solar_battery our_bill_after, a.annual_benefit our_benefit FROM pylon_comparisons p JOIN assessments a ON a.id=p.assessment_id ORDER BY p.created_at DESC").all<Record<string, unknown>>(),
    db.prepare("SELECT * FROM api_usage_events ORDER BY created_at DESC").all<Record<string, unknown>>(),
  ]);
  const toRows = (records: Record<string, unknown>[], headers: string[], numeric: Set<string>) => records.map(record => headers.map(key => ({ value: record[key], numeric: numeric.has(key) })));
  const assessmentHeaders = ["id","created_at","postcode","address","annual_usage_kwh","usage_source","panel_count","panel_watts","system_kwp","annual_generation_kwh","annual_bill_before","annual_bill_solar_only","annual_bill_solar_battery","annual_benefit"];
  const leadHeaders = ["id","created_at","assessment_id","postcode","address","customer_name","phone","email","preferred_time","consent"];
  const comparisonHeaders = ["id","created_at","address","postcode","proposal_url","our_usage_kwh","pylon_annual_usage_kwh","our_panel_count","pylon_panel_count","our_generation_kwh","pylon_generation_kwh","our_bill_before","pylon_bill_before","our_bill_after","pylon_bill_after","our_benefit","input_hit_rate","generation_hit_rate","benefit_hit_rate","overall_hit_rate"];
  const apiHeaders = ["id","created_at","provider","endpoint","status_code","success"];
  const numeric = new Set(["annual_usage_kwh","panel_count","panel_watts","system_kwp","annual_generation_kwh","annual_bill_before","annual_bill_solar_only","annual_bill_solar_battery","annual_benefit","consent","our_usage_kwh","pylon_annual_usage_kwh","our_panel_count","pylon_panel_count","our_generation_kwh","pylon_generation_kwh","our_bill_before","pylon_bill_before","our_bill_after","pylon_bill_after","our_benefit","input_hit_rate","generation_hit_rate","benefit_hit_rate","overall_hit_rate","status_code","success"]);
  const workbook = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Styles><Style ss:ID="header"><Font ss:Bold="1" ss:Color="#FFFFFF"/><Interior ss:Color="#F15B32" ss:Pattern="Solid"/></Style></Styles>${sheet("Assessments",assessmentHeaders,toRows(assessments.results,assessmentHeaders,numeric))}${sheet("Leads",leadHeaders,toRows(leads.results,leadHeaders,numeric))}${sheet("Pylon Comparison",comparisonHeaders,toRows(comparisons.results,comparisonHeaders,numeric))}${sheet("API Usage",apiHeaders,toRows(apiUsage.results,apiHeaders,numeric))}</Workbook>`;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(workbook, { headers: { "Content-Type": "application/vnd.ms-excel; charset=utf-8", "Content-Disposition": `attachment; filename="apollogrid-data-${date}.xls"`, "Cache-Control": "private, no-store" } });
}
