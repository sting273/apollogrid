"use client";

import { FormEvent, useState } from "react";

type Option = { id: string; address: string; created_at: string };

export default function PylonCalibration({ assessments }: { assessments: Option[] }) {
  const [form, setForm] = useState({ assessmentId: assessments[0]?.id ?? "", proposalUrl: "", pylonAnnualUsageKwh: "", pylonPanelCount: "", pylonGenerationKwh: "", pylonBillBefore: "", pylonBillAfter: "" });
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setSaving(true); setStatus("");
    const response = await fetch("/api/pylon-comparisons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(Object.fromEntries(Object.entries(form).map(([key, value]) => key === "assessmentId" || key === "proposalUrl" ? [key, value] : [key, Number(value)]))) });
    const payload = await response.json() as { error?: string; overallHit?: number };
    setSaving(false);
    if (!response.ok) return setStatus(payload.error ?? "Unable to save comparison.");
    setStatus(`Saved · overall hit rate ${payload.overallHit?.toFixed(1)}%`);
    window.setTimeout(() => window.location.reload(), 700);
  };
  return <form className="calibration-form" onSubmit={submit}>
    <div><span>Pylon calibration</span><h2>Add a proposal benchmark</h2><p>Use the headline annual generation and first-year bills shown in Pylon. The model scores inputs, generation and benefit separately.</p></div>
    <label>Our assessment<select required value={form.assessmentId} onChange={e => setForm({...form, assessmentId:e.target.value})}>{assessments.map(item => <option key={item.id} value={item.id}>{item.address} · {new Date(item.created_at).toLocaleDateString("en-GB")}</option>)}</select></label>
    <label>Pylon proposal URL<input type="url" placeholder="https://app.getpylon.com/proposals/…" value={form.proposalUrl} onChange={e => setForm({...form, proposalUrl:e.target.value})}/></label>
    <div className="calibration-grid">
      <label>Annual use<input required type="number" min="1" value={form.pylonAnnualUsageKwh} onChange={e => setForm({...form,pylonAnnualUsageKwh:e.target.value})}/><small>kWh</small></label>
      <label>Panels<input required type="number" min="1" value={form.pylonPanelCount} onChange={e => setForm({...form,pylonPanelCount:e.target.value})}/></label>
      <label>Annual generation<input required type="number" min="1" value={form.pylonGenerationKwh} onChange={e => setForm({...form,pylonGenerationKwh:e.target.value})}/><small>kWh</small></label>
      <label>Bill before<input required type="number" step="0.01" value={form.pylonBillBefore} onChange={e => setForm({...form,pylonBillBefore:e.target.value})}/><small>£/year</small></label>
      <label>Bill after<input required type="number" step="0.01" value={form.pylonBillAfter} onChange={e => setForm({...form,pylonBillAfter:e.target.value})}/><small>Use a negative value for credit</small></label>
    </div>
    <button disabled={saving || !assessments.length}>{saving ? "Calculating…" : "Save comparison"}</button>{status && <strong className="calibration-status">{status}</strong>}
  </form>;
}
