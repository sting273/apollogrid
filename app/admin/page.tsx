import { requireChatGPTUser } from "../chatgpt-auth";
import { authorizeAdmin } from "../../db/admin";
import PylonCalibration from "./PylonCalibration";

export const dynamic = "force-dynamic";

type Assessment = { id: string; postcode: string; address: string; annual_usage_kwh: number; usage_source: string; panel_count: number; annual_generation_kwh: number; annual_bill_before: number; annual_bill_solar_battery: number; annual_benefit: number; created_at: string };
type Lead = { customer_name: string; phone: string; email: string; preferred_time: string; address: string | null; created_at: string };
type Comparison = { address: string; proposal_url: string; input_hit_rate: number; generation_hit_rate: number; benefit_hit_rate: number; overall_hit_rate: number; created_at: string };

const pounds = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);

export default async function AdminPage() {
  const user = await requireChatGPTUser("/admin");
  const { allowed, db } = await authorizeAdmin(user, true);
  if (!allowed) return <main className="admin-denied"><h1>Admin access required</h1><p>This dashboard contains customer contact information.</p></main>;
  const [summary, assessmentsResult, leadsResult, comparisonsResult] = await Promise.all([
    db.prepare(`SELECT COUNT(*) assessments, COUNT(DISTINCT postcode) postcodes, COUNT(DISTINCT address) addresses, (SELECT COUNT(*) FROM leads) leads FROM assessments`).first<Record<string, number>>(),
    db.prepare(`SELECT * FROM assessments ORDER BY created_at DESC LIMIT 100`).all<Assessment>(),
    db.prepare(`SELECT l.customer_name, l.phone, l.email, l.preferred_time, a.address, l.created_at FROM leads l LEFT JOIN assessments a ON a.id=l.assessment_id ORDER BY l.created_at DESC LIMIT 100`).all<Lead>(),
    db.prepare(`SELECT a.address, p.proposal_url, p.input_hit_rate, p.generation_hit_rate, p.benefit_hit_rate, p.overall_hit_rate, p.created_at FROM pylon_comparisons p JOIN assessments a ON a.id=p.assessment_id ORDER BY p.created_at DESC LIMIT 100`).all<Comparison>(),
  ]);
  const assessments = assessmentsResult.results;
  const comparisons = comparisonsResult.results;
  const average = (key: keyof Comparison) => comparisons.length ? comparisons.reduce((sum, item) => sum + Number(item[key] || 0), 0) / comparisons.length : 0;
  return <main className="admin-shell">
    <header><div><span>APOLLOGRID · OPERATIONS</span><h1>Solar assessment dashboard</h1><p>Signed in as {user.email}</p></div><a href="/">Open calculator →</a></header>
    <section className="admin-stats"><div><small>Assessments</small><strong>{summary?.assessments ?? 0}</strong></div><div><small>Unique postcodes</small><strong>{summary?.postcodes ?? 0}</strong></div><div><small>Unique addresses</small><strong>{summary?.addresses ?? 0}</strong></div><div><small>Customer leads</small><strong>{summary?.leads ?? 0}</strong></div></section>
    <section className="hit-summary"><div><span>Pylon model calibration</span><h2>{comparisons.length} benchmark{comparisons.length === 1 ? "" : "s"}</h2></div><div><small>Input match</small><strong>{average("input_hit_rate").toFixed(1)}%</strong></div><div><small>Generation hit</small><strong>{average("generation_hit_rate").toFixed(1)}%</strong></div><div><small>Benefit hit</small><strong>{average("benefit_hit_rate").toFixed(1)}%</strong></div><div className="overall"><small>Overall</small><strong>{average("overall_hit_rate").toFixed(1)}%</strong></div></section>
    <PylonCalibration assessments={assessments.map(({id,address,created_at}) => ({id,address,created_at}))}/>
    <section className="admin-panel"><div className="admin-panel-title"><span>Recent assessments</span><h2>What customers calculated</h2></div><div className="admin-table-wrap"><table><thead><tr><th>Date</th><th>Address</th><th>Use</th><th>Panels</th><th>Generation</th><th>Before</th><th>After</th><th>Benefit</th></tr></thead><tbody>{assessments.map(item => <tr key={item.id}><td>{new Date(item.created_at).toLocaleString("en-GB")}</td><td><b>{item.address}</b><small>{item.postcode} · {item.usage_source}</small></td><td>{item.annual_usage_kwh.toLocaleString()} kWh</td><td>{item.panel_count}</td><td>{item.annual_generation_kwh.toLocaleString()} kWh</td><td>{pounds(item.annual_bill_before)}</td><td>{pounds(item.annual_bill_solar_battery)}</td><td className="positive">{pounds(item.annual_benefit)}</td></tr>)}</tbody></table></div></section>
    <section className="admin-two"><div className="admin-panel"><div className="admin-panel-title"><span>Customer leads</span><h2>Contact requests</h2></div>{leadsResult.results.length ? leadsResult.results.map((lead,index) => <article className="lead-row" key={`${lead.email}-${index}`}><div><b>{lead.customer_name}</b><small>{lead.address ?? "Unlinked assessment"}</small></div><div><a href={`mailto:${lead.email}`}>{lead.email}</a><a href={`tel:${lead.phone}`}>{lead.phone}</a></div><span>{lead.preferred_time || "No preferred time"}</span></article>) : <p className="empty">No customer details submitted yet.</p>}</div>
    <div className="admin-panel"><div className="admin-panel-title"><span>Pylon comparisons</span><h2>Calibration history</h2></div>{comparisons.length ? comparisons.map((item,index) => <article className="comparison-row" key={`${item.address}-${index}`}><div><b>{item.address}</b>{item.proposal_url && <a href={item.proposal_url} target="_blank" rel="noreferrer">Proposal ↗</a>}</div><span>Input <b>{item.input_hit_rate.toFixed(0)}%</b></span><span>Generation <b>{item.generation_hit_rate.toFixed(0)}%</b></span><span>Benefit <b>{item.benefit_hit_rate.toFixed(0)}%</b></span><strong>{item.overall_hit_rate.toFixed(1)}%</strong></article>) : <p className="empty">Add the first Pylon benchmark above.</p>}</div></section>
    <footer>Overall hit rate = 20% input match + 40% generation + 40% first-year benefit. Keep the component scores visible when tuning the model.</footer>
  </main>;
}
