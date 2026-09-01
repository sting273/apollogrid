"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Stage = "find" | "roof" | "result" | "booking" | "complete";

const PANEL = {
  watts: 490,
  width: 1.13,
  height: 1.8,
  count: 14,
};

const ASSUMPTIONS = {
  annualYieldPerKwp: 880,
  selfUseRate: 0.45,
  importTariff: 0.27,
  exportTariff: 0.15,
  standingChargePerDay: 0.55,
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
};

const money = (value: number) => new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0,
}).format(value);

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
  const [usageSource, setUsageSource] = useState<"desnz" | "manual" | "fallback">("fallback");
  const [editingUsage, setEditingUsage] = useState(false);
  const [form, setForm] = useState({ phone: "", email: "", time: "" });

  const estimate = useMemo(() => {
    const panelArea = PANEL.width * PANEL.height;
    const annualYieldPerKwp = solar?.annualYieldPerKwp ?? ASSUMPTIONS.annualYieldPerKwp;
    const panelCount = solar ? Math.min(solar.maxPanels, Math.max(1, Math.ceil(usage / (PANEL.watts / 1000 * annualYieldPerKwp)))) : PANEL.count;
    const totalPanelArea = panelArea * panelCount;
    const efficiency = PANEL.watts / (panelArea * 1000) * 100;
    const systemKwp = PANEL.watts * panelCount / 1000;
    const generation = Math.round(systemKwp * annualYieldPerKwp);
    const selfConsumed = Math.min(Math.round(generation * ASSUMPTIONS.selfUseRate), usage);
    const exported = Math.max(generation - selfConsumed, 0);
    const gridImportBefore = usage;
    const gridImportAfter = Math.max(usage - selfConsumed, 0);
    const standingCharge = ASSUMPTIONS.standingChargePerDay * 365;
    const currentBill = gridImportBefore * ASSUMPTIONS.importTariff + standingCharge;
    const gridBillAfter = gridImportAfter * ASSUMPTIONS.importTariff + standingCharge;
    const exportIncome = exported * ASSUMPTIONS.exportTariff;
    const effectiveBillAfter = Math.max(gridBillAfter - exportIncome, 0);
    const annualBenefit = currentBill - effectiveBillAfter;
    const billReduction = annualBenefit / currentBill * 100;
    const usageCovered = selfConsumed / usage * 100;

    return { panelArea, panelCount, annualYieldPerKwp, totalPanelArea, efficiency, systemKwp, generation, selfConsumed, exported, gridImportAfter, standingCharge, currentBill, gridBillAfter, exportIncome, effectiveBillAfter, annualBenefit, billReduction, usageCovered };
  }, [usage, solar]);

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
          setUsage(Math.round(data.electricity.medianKwh));
          setUsageSource("desnz");
        } else {
          setUsage(5000);
          setUsageSource("fallback");
        }
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
  const go = (next: Stage) => { setStage(next); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const submit = (e: FormEvent) => { e.preventDefault(); go("complete"); };

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
        <div className="map-wrap"><RoofGraphic panels={estimate.panelCount} label={address.split(",")[0]}/><div className="demo-flag">{solar ? `Google Solar · ${solar.imageryQuality}` : "Indicative roof data"}</div></div>
        <div className="roof-details">
          <div className="found"><span>✓</span><div><b>{solar ? "Building-level solar data found" : "Indicative solar potential"}</b><small>{solar ? `${solar.roofAreaMeters2?.toFixed(0) ?? "—"}m² roof · ${solar.maxSunshineHoursPerYear?.toFixed(0) ?? "—"} peak sunshine hours/year` : roofError || "Google Solar data was unavailable; fallback assumptions are shown."}</small></div></div>
          <div className="stat-grid">
            <div><small>Max. panels</small><strong>{solar?.maxPanels ?? PANEL.count}</strong></div>
            <div><small>Panel rating</small><strong>{PANEL.watts} <em>W</em></strong></div>
            <div><small>Suggested system</small><strong>{estimate.panelCount} <em>panels</em></strong></div>
            <div><small>Panel dimensions</small><strong className="compact-stat">{PANEL.height} × {PANEL.width}m</strong></div>
          </div>
          <div className="panel-spec"><div><span>Suggested system size</span><b>{estimate.systemKwp.toFixed(2)} kWp · {estimate.totalPanelArea.toFixed(1)}m²</b></div><div><span>{solar ? "Building-specific yield" : "Fallback annual yield"}</span><b>{estimate.annualYieldPerKwp} kWh/kWp</b></div></div>
          <div className="energy-card"><div><span>Estimated annual electricity use</span><small>{usageSource === "desnz" && lookup?.electricity ? lookup.electricity.scope === "baseline" ? "2,000 kWh minimum planning baseline" : `${lookup.electricity.scope === "postcode" ? lookup.postcode : `${lookup.postcode.split(" ")[0]} area`} median · DESNZ ${lookup.electricity.year} · ${lookup.electricity.meters.toLocaleString("en-GB")} meters` : usageSource === "manual" ? "Customer-provided figure" : "National fallback estimate"}</small></div>{editingUsage ? <div className="usage-edit"><input type="number" min="1000" max="30000" value={usage} onChange={e => setUsage(Math.max(Number(e.target.value), 1))}/><span>kWh/year</span><button onClick={() => { setEditingUsage(false); setUsageSource("manual"); }}>Use this</button></div> : <div className="usage-value"><strong>{usage.toLocaleString("en-GB")}</strong><span>kWh/year</span><button onClick={() => setEditingUsage(true)}>Edit</button></div>}<p>{lookup?.electricity?.fallbackReason === "postcode_below_minimum" ? `${lookup.postcode} was below 2,000 kWh, so the wider ${lookup.postcode.split(" ")[0]} median is used.` : lookup?.electricity?.fallbackReason === "missing_postcode" ? "No postcode row was published, so the wider postcode-area median is used." : lookup?.electricity?.fallbackReason === "outcode_below_minimum" ? "Both postcode levels were below 2,000 kWh, so the minimum planning baseline is used." : usageSource === "desnz" && lookup?.electricity && lookup.electricity.scope === "postcode" && lookup.electricity.meters < 10 ? "Small postcode sample: use the customer’s actual bill where available." : "Use this local estimate or replace it with the customer’s actual annual electricity usage."}</p></div>
          <button className="primary full" onClick={() => go("result")}>Calculate my yearly savings <span>→</span></button>
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
        <div className="generation-block"><span>Estimated annual generation</span><strong>{estimate.generation.toLocaleString("en-GB")}</strong><b>kWh / year</b><small>{estimate.systemKwp.toFixed(2)} kWp system · {estimate.totalPanelArea.toFixed(1)}m² of panels</small></div>
        <div className="impact-block"><span>Estimated annual benefit</span><strong>{money(estimate.annualBenefit)}</strong><b>per year</b><div className="reduction-ring"><i style={{ "--value": `${estimate.billReduction * 3.6}deg` } as React.CSSProperties}/><span><b>{estimate.billReduction.toFixed(0)}%</b> lower effective electricity cost</span></div></div>
      </div>

      <div className="utility-card">
        <div className="utility-intro"><span className="utility-icon">▰</span><h3>Utility costs</h3><p>How much could you save after installing solar?</p></div>
        <div className="utility-table">
          <div className="utility-head"><span/><b>Before solar</b><b>With solar</b></div>
          <div className="utility-row"><span>Average monthly bill</span><strong>{money(estimate.currentBill / 12)}</strong><strong className="solar-cost">{money(estimate.effectiveBillAfter / 12)} <em>↓ {estimate.billReduction.toFixed(0)}%</em></strong></div>
          <div className="utility-row annual"><span>Annual bill</span><div><strong>{money(estimate.currentBill)}</strong><small>Current estimated cost</small></div><div><strong className="solar-cost">{money(estimate.effectiveBillAfter)} <em>↓ {estimate.billReduction.toFixed(0)}%</em></strong><small>Est. annual savings {money(estimate.annualBenefit)}</small></div></div>
        </div>
      </div>

      <div className="bill-breakdown"><span>How we reached the solar figure</span><p><b>{estimate.gridImportAfter.toLocaleString("en-GB")} kWh</b> remaining grid import</p><p><b>{money(estimate.gridBillAfter)}</b> grid bill incl. standing charge</p><p className="credit"><b>− {money(estimate.exportIncome)}</b> estimated export income</p></div>

      <div className="energy-flow">
        <div><small>Used directly in your home</small><strong>{estimate.selfConsumed.toLocaleString("en-GB")} kWh</strong><span>{estimate.usageCovered.toFixed(0)}% of household use covered</span></div>
        <div><small>Sent back to the grid</small><strong>{estimate.exported.toLocaleString("en-GB")} kWh</strong><span>Estimated at {(ASSUMPTIONS.exportTariff * 100).toFixed(0)}p/kWh export rate</span></div>
        <div><small>Panel specification</small><strong>{PANEL.watts}W · {estimate.efficiency.toFixed(1)}%</strong><span>{PANEL.height}m × {PANEL.width}m per panel</span></div>
      </div>

      <div className="assumption-box"><b>How this estimate works</b><span>{estimate.annualYieldPerKwp} kWh/kWp {solar ? "Google Solar building yield" : "fallback annual yield"}</span><span>{(ASSUMPTIONS.selfUseRate * 100).toFixed(0)}% direct self-use</span><span>{(ASSUMPTIONS.importTariff * 100).toFixed(0)}p/kWh import</span><span>{(ASSUMPTIONS.exportTariff * 100).toFixed(0)}p/kWh export</span><p>{solar ? "Roof and solar data © Google Maps. " : ""}No system price, battery, finance, ROI or payback assumptions are included.</p></div>
      <button className="primary result-cta" onClick={() => go("booking")}>Book a free technical survey <span>→</span></button>
      <p className="assumption">These figures are illustrative. A detailed survey will confirm usable roof area, shading, orientation and expected generation.</p>
    </section>
  </main>;

  if (stage === "booking") return <main className="app-shell booking-bg">
    <nav className="nav"><Brand/><button className="text-button" onClick={() => go("result")}>← Back to results</button></nav>
    <section className="booking-step">
      <div className="booking-summary"><div className="eyebrow"><span/> Your solar potential</div><h2>Ready to confirm your roof?</h2><p>A free on-site survey confirms roof capacity, shading, electrical setup and a more accurate generation estimate.</p><div className="summary-card"><small>{solar ? "Google Solar building assessment" : "Indicative roof assessment"}</small><h3>{estimate.panelCount} × {PANEL.watts}W panels</h3><div><span>System potential</span><b>{estimate.systemKwp.toFixed(2)} kWp</b></div><div><span>Estimated annual generation</span><b>{estimate.generation.toLocaleString("en-GB")} kWh</b></div><div><span>Estimated annual benefit</span><b>{money(estimate.annualBenefit)}</b></div></div><p className="address-note">⌖ {address}</p></div>
      <form className="booking-form" onSubmit={submit}><span className="form-kicker">Free technical survey</span><h3>Where should we contact you?</h3><p>No lengthy form. Just the details needed to arrange your visit.</p><label>Phone number <b>*</b><input required type="tel" placeholder="e.g. 07700 900000" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})}/></label><label>Email address <b>*</b><input required type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({...form, email:e.target.value})}/></label><label>Preferred survey time <small>Optional</small><input placeholder="e.g. Weekday mornings" value={form.time} onChange={e => setForm({...form, time:e.target.value})}/></label><label className="consent"><input required type="checkbox"/><span>I agree to be contacted about this solar assessment and survey.</span></label><button className="primary full" type="submit">Book my free survey <span>→</span></button><small className="privacy">Your details are used only to arrange your solar consultation.</small></form>
    </section>
  </main>;

  return <main className="complete"><div className="complete-mark">✓</div><div className="eyebrow"><span/> Survey request received</div><h2>Your roof is one step closer.</h2><p>We&apos;ll contact you using the details provided to arrange the free technical survey for:</p><strong>{address}</strong><div className="next-steps"><div><b>1</b><span><strong>We call or email</strong>Confirm a suitable appointment</span></div><div><b>2</b><span><strong>Technical survey</strong>Check roof capacity and shading</span></div><div><b>3</b><span><strong>Your accurate assessment</strong>Confirm generation, savings and options</span></div></div><button className="secondary" onClick={() => window.location.reload()}>Start another assessment</button><small>This is a demo — no information has been sent.</small></main>;
}
