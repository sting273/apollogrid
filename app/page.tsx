"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import SolarRoofMap from "./SolarRoofMap";
import { buildThirtyYearProjection, ENERGY_MODEL, MonthlyEnergyBill, ProjectionPoint, simulateEnergy } from "./energyModel";

type Stage = "find" | "roof" | "result" | "booking" | "complete";

const PANEL = {
  watts: 490,
  width: 1.13,
  height: 1.8,
  count: 14,
};

const ASSUMPTIONS = {
  annualYieldPerKwp: 880,
};

type Lookup = {
  postcode: string;
  latitude: number;
  longitude: number;
  region: string | null;
  district: string | null;
  electricity: null | { meters: number; meanKwh: number; medianKwh: number; year: number; source: string; scope: "postcode" | "outcode" | "baseline"; fallbackReason: null | "missing_postcode" | "postcode_below_minimum" | "outcode_below_minimum" };
  addressLookup: { configured: boolean; addresses: AddressOption[] };
};

type AddressOption = { formatted: string; latitude: number; longitude: number };
type SolarData = {
  matched: true;
  maxPanels: number;
  annualYieldPerKwp: number;
  maxArrayAreaMeters2: number | null;
  roofAreaMeters2: number | null;
  maxSunshineHoursPerYear: number | null;
  roofPitchDegrees: number | null;
  roofAzimuthDegrees: number | null;
  imageryQuality: "HIGH" | "MEDIUM" | "BASE";
  imageryDate: { year?: number; month?: number; day?: number } | null;
  imageryUrl: string;
  imageryCenter: { latitude: number; longitude: number };
  panels: Array<{
    center: { latitude: number; longitude: number };
    orientation: "LANDSCAPE" | "PORTRAIT";
    azimuthDegrees: number;
    yearlyEnergyDcKwh: number | null;
  }>;
};

const money = (value: number) => new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
}).format(value);

function MonthlyBillChart({ solarOnly, solarBattery }: { solarOnly: MonthlyEnergyBill[]; solarBattery: MonthlyEnergyBill[] }) {
  const positiveMax = Math.max(...solarOnly.flatMap((month, index) => [month.before, Math.max(month.after, 0), Math.max(solarBattery[index].after, 0)]), 1);
  const negativeMax = Math.max(...solarOnly.flatMap((month, index) => [Math.max(-month.after, 0), Math.max(-solarBattery[index].after, 0)]), 1);
  return <section className="comparison-chart" aria-label="Monthly electricity bill before and after solar and battery">
    <div className="chart-heading"><div><span>Monthly comparison</span><h3>What changes through the year</h3></div><div className="chart-legend"><span><i className="before"/>Before</span><span><i className="solar"/>Solar only</span><span><i className="after"/>Solar + battery</span></div></div>
    <div className="monthly-chart">
      {solarOnly.map((month, index) => <div className="month-column" key={month.month}>
        <div className="positive-zone">
          <i className="bill-bar before" style={{ height: `${month.before / positiveMax * 100}%` }} title={`${month.month}: ${money(month.before)} before`}/>
          {month.after >= 0 ? <i className="bill-bar solar" style={{ height: `${month.after / positiveMax * 100}%` }} title={`${month.month}: ${money(month.after)} solar only`}/> : <i/>}
          {solarBattery[index].after >= 0 ? <i className="bill-bar after" style={{ height: `${solarBattery[index].after / positiveMax * 100}%` }} title={`${month.month}: ${money(solarBattery[index].after)} solar and battery`}/> : <i/>}
        </div>
        <div className="chart-zero"/>
        <div className="negative-zone">{month.after < 0 ? <i className="bill-bar solar credit" style={{ height: `${-month.after / negativeMax * 100}%` }} title={`${month.month}: ${money(month.after)} solar-only credit`}/> : <i/>}{solarBattery[index].after < 0 && <i className="bill-bar after credit" style={{ height: `${-solarBattery[index].after / negativeMax * 100}%` }} title={`${month.month}: ${money(solarBattery[index].after)} solar and battery credit`}/>}</div>
        <b>{month.month}</b><small>{money(solarBattery[index].after)}</small>
      </div>)}
    </div>
    <p>Negative months represent an estimated bill credit after export income.</p>
  </section>;
}

function ProjectionChart({ points }: { points: ProjectionPoint[] }) {
  const max = Math.max(...points.map((point) => point.before), 1);
  return <section className="comparison-chart projection-chart" aria-label="Thirty year electricity bill projection">
    <div className="chart-heading"><div><span>30-year utility view</span><h3>Estimated bill across all three scenarios</h3></div><div className="chart-legend"><span><i className="before"/>Before</span><span><i className="solar"/>Solar only</span><span><i className="after"/>Solar + battery</span></div></div>
    <div className="year-chart">{points.map((point) => <div className="year-column" key={point.year} title={`Year ${point.year}: ${money(point.before)} before, ${money(point.solarOnly)} solar only, ${money(point.solarBattery)} solar and battery`}><div><i className="before" style={{ height: `${point.before / max * 100}%` }}/><i className="solar" style={{ height: `${Math.max(point.solarOnly, 0) / max * 100}%` }}/><i className="after" style={{ height: `${Math.max(point.solarBattery, 0) / max * 100}%` }}/></div><span>{point.year === 1 || point.year % 5 === 0 ? point.year : ""}</span></div>)}</div>
    <p>Utility rates rise 5% per year. Solar output is reduced by 1% in year one, then 0.35% of initial output per year. No purchase price or replacement cost is included.</p>
  </section>;
}

function Brand() {
  return <button className="brand" onClick={() => window.location.reload()} aria-label="Apollogrid home"><span className="brand-mark"><i/><i/><i/></span><span>APOLLOGRID</span></button>;
}

function Progress({ stage }: { stage: Stage }) {
  const current = stage === "find" ? 1 : stage === "roof" ? 2 : 3;
  return <div className="progress" aria-label={`Step ${current} of 3`}>
    {["Find your home", "See your roof", "See your savings"].map((label, i) => <div className={current >= i + 1 ? "active" : ""} key={label}><b>{current > i + 1 ? "✓" : i + 1}</b><span>{label}</span>{i < 2 && <i />}</div>)}
  </div>;
}

function RoofGraphic({ panels = PANEL.count, label = "Your postcode area" }: { panels?: number; label?: string }) {
  return <div className="roof-scene" aria-label={`Illustrative roof with ${panels} solar panels`}>
    <div className="roof-label"><span>●</span> Roof location<br/><b>{label}</b></div>
    <div className="compass">N<br/><span>↑</span></div>
    <div className="roof-shape">{Array.from({ length: Math.min(panels, 16) }).map((_, i) => <span className="panel" key={i} />)}</div>
    <div className="map-tag">Roof assessment preview</div>
  </div>;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("find");
  const [postcode, setPostcode] = useState("NW4 1HJ");
  const [searched, setSearched] = useState(false);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [lookupError, setLookupError] = useState("");
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [premise, setPremise] = useState("");
  const [address, setAddress] = useState("NW4 1HJ");
  const [solar, setSolar] = useState<SolarData | null>(null);
  const [loadingRoof, setLoadingRoof] = useState(false);
  const [roofError, setRoofError] = useState("");
  const [usage, setUsage] = useState(5000);
  const [usageBaseline, setUsageBaseline] = useState(5000);
  const [usageSource, setUsageSource] = useState<"desnz" | "manual" | "fallback">("fallback");
  const [editingUsage, setEditingUsage] = useState(false);
  const [usageDraft, setUsageDraft] = useState("");
  const [panelOverride, setPanelOverride] = useState<number | null>(null);
  const [editingPanels, setEditingPanels] = useState(false);
  const [panelDraft, setPanelDraft] = useState("");
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", time: "", consent: false });
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const estimate = useMemo(() => {
    const panelArea = PANEL.width * PANEL.height;
    const annualYieldPerKwp = solar?.annualYieldPerKwp ?? ASSUMPTIONS.annualYieldPerKwp;
    const suggestedPanelCount = solar ? Math.min(solar.maxPanels, Math.max(1, Math.ceil(usage / (PANEL.watts / 1000 * annualYieldPerKwp)))) : PANEL.count;
    const panelCount = panelOverride ?? suggestedPanelCount;
    const totalPanelArea = panelArea * panelCount;
    const efficiency = PANEL.watts / (panelArea * 1000) * 100;
    const systemKwp = PANEL.watts * panelCount / 1000;
    const dcGeneration = Math.round(systemKwp * annualYieldPerKwp);
    const deliveredGeneration = Math.round(dcGeneration * ENERGY_MODEL.deliveredEnergyFactor);
    const solarOnly = simulateEnergy({ annualUsageKwh: usage, annualGenerationKwh: deliveredGeneration, batteryEnabled: false });
    const solarBattery = simulateEnergy({ annualUsageKwh: usage, annualGenerationKwh: deliveredGeneration, batteryEnabled: true });
    const projection = buildThirtyYearProjection(usage, deliveredGeneration);

    return { panelArea, panelCount, suggestedPanelCount, annualYieldPerKwp, totalPanelArea, efficiency, systemKwp, dcGeneration, deliveredGeneration, solarOnly, solarBattery, projection };
  }, [usage, solar, panelOverride]);

  useEffect(() => {
    const compact = postcode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(compact)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoadingLookup(true);
      setLookupError("");
      try {
        const response = await fetch(`/api/assessment?postcode=${encodeURIComponent(compact)}`, { signal: controller.signal, cache: "no-store" });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Unable to load postcode data.");
        const raw = payload as Lookup & { addressLookup: { configured: boolean; addresses: Array<AddressOption | string> } };
        const addresses = raw.addressLookup.addresses.flatMap((item) => {
          if (typeof item === "string") return item.trim() ? [{ formatted: item, latitude: raw.latitude, longitude: raw.longitude }] : [];
          return item?.formatted?.trim() ? [item] : [];
        });
        const data: Lookup = { ...raw, addressLookup: { ...raw.addressLookup, addresses } };
        setLookup(data);
        setPostcode(data.postcode);
        setSearched(true);
        setPremise("");
        if (data.electricity?.medianKwh) {
          const baseline = Math.round(data.electricity.medianKwh);
          setUsage(baseline);
          setUsageBaseline(baseline);
          setUsageSource("desnz");
        } else {
          setUsage(5000);
          setUsageBaseline(5000);
          setUsageSource("fallback");
        }
        setEditingUsage(false);
        setUsageDraft("");
      } catch (error) {
        if (!controller.signal.aborted) {
          setLookup(null);
          setSearched(false);
          setLookupError(error instanceof Error ? error.message : "Unable to load postcode data.");
        }
      } finally {
        if (!controller.signal.aborted) setLoadingLookup(false);
      }
    }, 550);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [postcode]);

  const findHome = () => { if (lookup) setSearched(true); };
  const chooseAddress = async (item: AddressOption) => {
    setAddress(item.formatted);
    setPanelOverride(null);
    setEditingPanels(false);
    setPanelDraft("");
    setLoadingRoof(true);
    setRoofError("");
    try {
      const response = await fetch(`/api/solar?lat=${encodeURIComponent(item.latitude)}&lon=${encodeURIComponent(item.longitude)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "No building-level solar data was found.");
      setSolar(payload as SolarData);
    } catch (error) {
      setSolar(null);
      setRoofError(error instanceof Error ? error.message : "No building-level solar data was found.");
    } finally {
      setLoadingRoof(false);
      setStage("roof");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const editPanelCount = () => { setPanelDraft(String(estimate.panelCount)); setEditingPanels(true); };
  const applyPanelCount = () => {
    const parsed = Number.parseInt(panelDraft, 10);
    if (!Number.isFinite(parsed)) return;
    setPanelOverride(Math.max(1, Math.min(parsed, 60)));
    setEditingPanels(false);
  };
  const editAnnualUsage = () => { setUsageDraft(String(usage)); setEditingUsage(true); };
  const applyAnnualUsage = () => {
    const parsed = Number.parseInt(usageDraft, 10);
    if (!Number.isFinite(parsed)) return;
    setUsage(Math.max(1000, Math.min(parsed, 30000)));
    setUsageSource("manual");
    setEditingUsage(false);
  };
  const resetAnnualUsage = () => {
    setUsage(usageBaseline);
    setUsageSource(lookup?.electricity ? "desnz" : "fallback");
    setEditingUsage(false);
    setUsageDraft("");
  };
  const calculateSavings = async () => {
    go("result");
    try {
      const response = await fetch("/api/assessments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        postcode: lookup?.postcode ?? postcode, address, annualUsageKwh: usage, usageSource, panelCount: estimate.panelCount, panelWatts: PANEL.watts,
        systemKwp: estimate.systemKwp, annualGenerationKwh: estimate.deliveredGeneration, annualBillBefore: estimate.solarOnly.annualBillBefore,
        annualBillSolarOnly: estimate.solarOnly.annualBillAfter, annualBillSolarBattery: estimate.solarBattery.annualBillAfter, annualBenefit: estimate.solarBattery.annualBenefit,
      }) });
      if (response.ok) setAssessmentId((await response.json() as { id: string }).id);
    } catch { /* The calculator remains usable if analytics is temporarily unavailable. */ }
  };
  const go = (next: Stage) => { setStage(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSubmitting(true); setFormError("");
    try {
      const response = await fetch("/api/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assessmentId, customerName: form.name, phone: form.phone, email: form.email, preferredTime: form.time, consent: form.consent }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || "Unable to save your request.");
      go("complete");
    } catch (error) { setFormError(error instanceof Error ? error.message : "Unable to save your request."); }
    finally { setSubmitting(false); }
  };

  if (stage === "find") return <main>
    <nav className="nav"><Brand/><span className="nav-note">60-second solar estimate</span></nav>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><span/> Free home assessment</div>
        <h1>See what your roof could <em>save you.</em></h1>
        <p className="lede">See your roof&apos;s solar potential, estimated yearly generation and possible electricity bill reduction — in under 60 seconds.</p>
        <div className="hero-steps"><div><b>1</b><span><strong>Find your home</strong>Enter your postcode</span></div><i/><div><b>2</b><span><strong>See your roof</strong>Estimate panel capacity</span></div><i/><div><b>3</b><span><strong>See your savings</strong>Compare your yearly bill</span></div></div>
        <div className="finder">
          <label htmlFor="postcode">Enter your postcode</label>
          <div className="finder-row"><input id="postcode" value={postcode} onChange={(e) => { setPostcode(e.target.value.toUpperCase()); setLookup(null); setLookupError(""); setSearched(false); }} onKeyDown={(e) => e.key === "Enter" && findHome()} placeholder="e.g. NW4 1HJ"/><button onClick={findHome} disabled={!lookup || loadingLookup}>{loadingLookup ? "Loading…" : "Find my home"} <span>→</span></button></div>
          {lookupError && <div className="lookup-error">{lookupError}</div>}
          {searched && lookup && <div className="address-list"><p>{loadingRoof ? "Matching your roof with Google Solar…" : lookup.addressLookup.addresses.length ? "Select your address" : `Address in ${lookup.postcode}`}</p>{lookup.addressLookup.addresses.length ? lookup.addressLookup.addresses.map(item => <button key={item.formatted} disabled={loadingRoof} onClick={() => chooseAddress(item)}><span>{item.formatted}</span><b>→</b></button>) : <div className="manual-address"><label htmlFor="premise">House number or name</label><div><input id="premise" value={premise} onChange={e => setPremise(e.target.value)} placeholder="e.g. 6 Garrick Drive"/><button disabled={!premise.trim() || loadingRoof} onClick={() => chooseAddress({ formatted: `${premise.trim()}, ${lookup.postcode}`, latitude: lookup.latitude, longitude: lookup.longitude })}>{loadingRoof ? "Matching…" : "Continue →"}</button></div><small>{lookup.addressLookup.configured ? "No delivery addresses were returned for this postcode." : "Automatic address lists require a Royal Mail PAF address-data connection."}</small></div>}</div>}
          <small><span>⌖</span> Postcode electricity use comes from DESNZ 2024 official statistics.</small>
        </div>
      </div>
      <div className="hero-visual"><div className="sun-glow"/><RoofGraphic label={lookup?.postcode ?? postcode}/><div className="potential"><span>Illustrative potential</span><strong>{PANEL.count} panels</strong><b>{estimate.systemKwp.toFixed(2)} kWp</b></div></div>
    </section>
    <div className="trust-bar"><span>Built for UK homes</span><b>490W solar panels</b><b>Address-led estimate</b><b>No product pricing assumed</b></div>
  </main>;

  if (stage === "roof") return <main className="app-shell">
    <nav className="nav"><Brand/><button className="text-button" onClick={() => go("find")}>← Change address</button></nav>
    <Progress stage={stage}/>
    <section className="roof-step">
      <div className="section-heading"><div className="eyebrow"><span/> Step 2 — Your roof</div><h2>We found your home.</h2><p>{address}</p></div>
      <div className="roof-grid">
        <div className="map-wrap">{solar?.imageryUrl && solar.panels.length ? <SolarRoofMap imageryUrl={solar.imageryUrl} panels={solar.panels} panelCount={estimate.panelCount} label={address.split(",")[0]}/> : <RoofGraphic panels={estimate.panelCount} label={address.split(",")[0]}/>}<div className="demo-flag">{solar ? `Google Solar · ${solar.imageryQuality}` : "Indicative roof data"}</div></div>
        <div className="roof-details">
          <div className="found"><span>✓</span><div><b>{solar ? "Building-level solar data found" : "Indicative solar potential"}</b><small>{solar ? `${solar.roofAreaMeters2?.toFixed(0) ?? "—"}m² roof · ${solar.maxSunshineHoursPerYear?.toFixed(0) ?? "—"} peak sunshine hours/year` : roofError || "Google Solar data was unavailable; fallback assumptions are shown."}</small></div></div>
          <div className="stat-grid">
            <div><small>Max. panels</small><strong>{solar?.maxPanels ?? PANEL.count}</strong></div>
            <div><small>Panel rating</small><strong>{PANEL.watts} <em>W</em></strong></div>
            <div><small>Google-based suggestion</small><strong>{estimate.suggestedPanelCount} <em>panels</em></strong></div>
            <div><small>Panel dimensions</small><strong className="compact-stat">{PANEL.height} × {PANEL.width}m</strong></div>
          </div>
          <div className="panel-count-card"><div><span>Panels used in savings model</span><small>{panelOverride === null ? "Using the Google-based suggestion" : "Manual scenario override"}</small></div>{editingPanels ? <div className="panel-count-edit"><input aria-label="Panel count" type="number" min="1" max="60" inputMode="numeric" value={panelDraft} onChange={e => setPanelDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && applyPanelCount()}/><span>panels</span><button onClick={applyPanelCount}>Use this</button></div> : <div className="panel-count-value"><strong>{estimate.panelCount}</strong><span>panels</span><button onClick={editPanelCount}>Edit</button>{panelOverride !== null && <button className="reset" onClick={() => setPanelOverride(null)}>Reset</button>}</div>}<p>{panelOverride !== null && solar && panelOverride > solar.maxPanels ? `Testing ${panelOverride} panels even though Google Solar returned ${solar.maxPanels}. Confirmed survey layouts can override the API estimate.` : "Change this when a survey, proposal or signed design confirms a different panel count."}</p></div>
          <div className="panel-spec"><div><span>Modelled system size</span><b>{estimate.systemKwp.toFixed(2)} kWp · {estimate.totalPanelArea.toFixed(1)}m²</b></div><div><span>{solar ? "Building-specific yield" : "Fallback annual yield"}</span><b>{estimate.annualYieldPerKwp} kWh/kWp</b></div></div>
          <div className="energy-card"><div><span>Annual electricity use in savings model</span><small>{usageSource === "desnz" && lookup?.electricity ? lookup.electricity.scope === "baseline" ? "2,000 kWh minimum planning baseline" : `${lookup.electricity.scope === "postcode" ? lookup.postcode : `${lookup.postcode.split(" ")[0]} area`} median · DESNZ ${lookup.electricity.year} · ${lookup.electricity.meters.toLocaleString("en-GB")} meters` : usageSource === "manual" ? "Customer-provided figure · calculations updated" : "National fallback estimate"}</small></div>{editingUsage ? <div className="usage-edit"><input aria-label="Annual electricity use" type="number" min="1000" max="30000" step="100" inputMode="numeric" value={usageDraft} onChange={e => setUsageDraft(e.target.value)} onKeyDown={e => e.key === "Enter" && applyAnnualUsage()}/><span>kWh/year</span><button onClick={applyAnnualUsage}>Use this</button></div> : <div className="usage-value"><strong>{usage.toLocaleString("en-GB")}</strong><span>kWh/year</span><button onClick={editAnnualUsage}>Edit</button>{usageSource === "manual" && <button className="reset" onClick={resetAnnualUsage}>Reset</button>}</div>}<p>{usageSource === "manual" ? `Using the customer figure. Reset to ${usageBaseline.toLocaleString("en-GB")} kWh/year to use the published estimate again.` : lookup?.electricity?.fallbackReason === "postcode_below_minimum" ? `${lookup.postcode} was below 2,000 kWh, so the wider ${lookup.postcode.split(" ")[0]} median is used.` : lookup?.electricity?.fallbackReason === "missing_postcode" ? "No postcode row was published, so the wider postcode-area median is used." : lookup?.electricity?.fallbackReason === "outcode_below_minimum" ? "Both postcode levels were below 2,000 kWh, so the minimum planning baseline is used." : usageSource === "desnz" && lookup?.electricity && lookup.electricity.scope === "postcode" && lookup.electricity.meters < 10 ? "Small postcode sample: use the customer’s actual bill where available." : "Replace this estimate with the annual kWh shown on the customer’s electricity bill."}</p></div>
          <button className="primary full" onClick={calculateSavings}>Calculate my yearly savings <span>→</span></button>
          <p className="fineprint">{solar ? "Roof and solar data © Google Maps. Final capacity requires a technical survey." : "Indicative assessment only. Final roof capacity and annual generation require detailed solar and technical data."}</p>
        </div>
      </div>
    </section>
  </main>;

  if (stage === "result") return <main className="app-shell result-bg">
    <nav className="nav"><Brand/><button className="text-button" onClick={() => go("roof")}>← Back to roof</button></nav>
    <Progress stage={stage}/>
    <section className="result-step">
      <div className="section-heading centered"><div className="eyebrow"><span/> Step 3 — Your savings</div><h2>Your roof could make a real difference.</h2><p>Based on {estimate.panelCount} × {PANEL.watts}W panels and {usage.toLocaleString("en-GB")} kWh estimated household use.</p></div>

      <div className="result-hero">
        <div className="generation-block"><span>Estimated usable annual generation</span><strong>{estimate.deliveredGeneration.toLocaleString("en-GB")}</strong><b>kWh / year</b><small>{estimate.dcGeneration.toLocaleString("en-GB")} kWh DC estimate × {(ENERGY_MODEL.deliveredEnergyFactor * 100).toFixed(0)}% delivered-energy factor</small></div>
        <div className="impact-block"><span>Solar + battery annual benefit</span><strong>{money(estimate.solarBattery.annualBenefit)}</strong><b>per year</b><div className="reduction-ring"><i style={{ "--value": `${Math.max(0, Math.min(estimate.solarBattery.billReduction, 100)) * 3.6}deg` } as React.CSSProperties}/><span><b>{estimate.solarBattery.billReduction.toFixed(0)}%</b> lower effective electricity cost</span></div></div>
      </div>

      <div className="utility-card">
        <div className="utility-intro"><span className="utility-icon">▰</span><h3>Utility costs</h3><p>See the separate contribution from solar and battery tariff shifting.</p></div>
        <div className="utility-table">
          <div className="utility-head"><span/><b>Before</b><b>Solar only</b><b>Solar + battery</b></div>
          <div className="utility-row"><span>Average monthly bill</span><strong>{money(estimate.solarOnly.annualBillBefore / 12)}</strong><strong>{money(estimate.solarOnly.annualBillAfter / 12)}</strong><strong className="solar-cost">{money(estimate.solarBattery.annualBillAfter / 12)}</strong></div>
          <div className="utility-row annual"><span>Annual bill</span><div><strong>{money(estimate.solarOnly.annualBillBefore)}</strong><small>Usage profile + tariff</small></div><div><strong>{money(estimate.solarOnly.annualBillAfter)}</strong><small>Saving {money(estimate.solarOnly.annualBenefit)}</small></div><div><strong className="solar-cost">{money(estimate.solarBattery.annualBillAfter)}</strong><small>Battery adds {money(estimate.solarBattery.annualBenefit - estimate.solarOnly.annualBenefit)}</small></div></div>
        </div>
      </div>

      <div className="bill-breakdown"><span>Solar + battery bill</span><p><b>{Math.round(estimate.solarBattery.gridImportKwh).toLocaleString("en-GB")} kWh</b> grid import incl. battery charging</p><p><b>{money(estimate.solarBattery.annualBillAfter + estimate.solarBattery.exportIncome)}</b> import + standing charge</p><p className="credit"><b>− {money(estimate.solarBattery.exportIncome)}</b> export income</p></div>

      <MonthlyBillChart solarOnly={estimate.solarOnly.monthly} solarBattery={estimate.solarBattery.monthly}/>

      <div className="energy-flow">
        <div><small>Direct solar to home</small><strong>{Math.round(estimate.solarBattery.directSolarKwh).toLocaleString("en-GB")} kWh</strong><span>{estimate.solarBattery.renewableCoverage.toFixed(0)}% true renewable coverage incl. solar-charged battery</span></div>
        <div><small>Battery from solar</small><strong>{Math.round(estimate.solarBattery.batterySolarToHomeKwh).toLocaleString("en-GB")} kWh</strong><span>Stored solar later supplied to the home</span></div>
        <div><small>Battery from off-peak grid</small><strong>{Math.round(estimate.solarBattery.batteryGridToHomeKwh).toLocaleString("en-GB")} kWh</strong><span>{estimate.solarBattery.gridShiftCoverage.toFixed(0)}% of use shifted from low-cost hours</span></div>
        <div><small>Sent back to the grid</small><strong>{Math.round(estimate.solarBattery.exportKwh).toLocaleString("en-GB")} kWh</strong><span>Estimated at {(ENERGY_MODEL.exportRate * 100).toFixed(0)}p/kWh export rate</span></div>
      </div>

      <div className="assumption-box"><b>Pylon-style half-hour model</b><span>{estimate.annualYieldPerKwp} kWh/kWp {solar ? "Google Solar building yield" : "fallback annual yield"}</span><span>{(ENERGY_MODEL.deliveredEnergyFactor * 100).toFixed(0)}% usable-energy factor after conversion and system losses</span><span>{ENERGY_MODEL.batteryCapacityKwh} kWh battery · {(ENERGY_MODEL.batteryRoundTripEfficiency * 100).toFixed(0)}% round-trip efficiency</span><span>{(ENERGY_MODEL.dayImportRate * 100).toFixed(0)}p day · {(ENERGY_MODEL.offPeakImportRate * 100).toFixed(0)}p 00:00–07:00</span><span>{(ENERGY_MODEL.exportRate * 100).toFixed(0)}p export · {(ENERGY_MODEL.standingChargePerDay * 100).toFixed(0)}p/day standing charge</span><p>{solar ? "Roof and solar data © Google Maps. " : ""}The raw DC estimate is reduced to 90% before bill modelling. Every half hour, solar serves the home first, then charges the battery; surplus is exported. The battery is topped up off-peak and discharges outside off-peak hours. Product price, finance, ROI and payback are excluded.</p></div>

      <ProjectionChart points={estimate.projection}/>
      <button className="primary result-cta" onClick={() => go("booking")}>Book a free technical survey <span>→</span></button>
      <p className="assumption">These figures are illustrative. A detailed survey will confirm usable roof area, shading, orientation and expected generation.</p>
    </section>
  </main>;

  if (stage === "booking") return <main className="app-shell booking-bg">
    <nav className="nav"><Brand/><button className="text-button" onClick={() => go("result")}>← Back to results</button></nav>
    <section className="booking-step">
      <div className="booking-summary"><div className="eyebrow"><span/> Your solar potential</div><h2>Ready to confirm your roof?</h2><p>A free on-site survey confirms roof capacity, shading, electrical setup and a more accurate generation estimate.</p><div className="summary-card"><small>{solar ? "Google Solar building assessment" : "Indicative roof assessment"}</small><h3>{estimate.panelCount} × {PANEL.watts}W panels</h3><div><span>System potential</span><b>{estimate.systemKwp.toFixed(2)} kWp</b></div><div><span>Usable annual generation</span><b>{estimate.deliveredGeneration.toLocaleString("en-GB")} kWh</b></div><div><span>Solar + battery benefit</span><b>{money(estimate.solarBattery.annualBenefit)}</b></div></div><p className="address-note">⌖ {address}</p></div>
      <form className="booking-form" onSubmit={submit}><span className="form-kicker">Free technical survey</span><h3>Where should we contact you?</h3><p>No lengthy form. Just the details needed to arrange your visit.</p><label>Name <b>*</b><input required autoComplete="name" placeholder="Your name" value={form.name} onChange={e => setForm({...form, name:e.target.value})}/></label><label>Phone number <b>*</b><input required type="tel" autoComplete="tel" placeholder="e.g. 07700 900000" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})}/></label><label>Email address <b>*</b><input required type="email" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({...form, email:e.target.value})}/></label><label>Preferred survey time <small>Optional</small><input placeholder="e.g. Weekday mornings" value={form.time} onChange={e => setForm({...form, time:e.target.value})}/></label><label className="consent"><input required type="checkbox" checked={form.consent} onChange={e => setForm({...form, consent:e.target.checked})}/><span>I agree to be contacted about this solar assessment and survey.</span></label>{formError && <div className="lookup-error">{formError}</div>}<button className="primary full" type="submit" disabled={submitting}>{submitting ? "Saving…" : "Book my free survey"} <span>→</span></button><small className="privacy">Your details are stored securely and used only to arrange your solar consultation.</small></form>
    </section>
  </main>;

  return <main className="complete"><div className="complete-mark">✓</div><div className="eyebrow"><span/> Survey request received</div><h2>Your roof is one step closer.</h2><p>We&apos;ll contact you using the details provided to arrange the free technical survey for:</p><strong>{address}</strong><div className="next-steps"><div><b>1</b><span><strong>We call or email</strong>Confirm a suitable appointment</span></div><div><b>2</b><span><strong>Technical survey</strong>Check roof capacity and shading</span></div><div><b>3</b><span><strong>Your accurate assessment</strong>Confirm generation, savings and options</span></div></div><button className="secondary" onClick={() => window.location.reload()}>Start another assessment</button><small>Your request has been saved for the Apollogrid team.</small></main>;
}
