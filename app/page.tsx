"use client";

import { FormEvent, useMemo, useState } from "react";

type Stage = "find" | "roof" | "options" | "booking" | "complete";
type PlanKey = "value" | "maximum";

const addresses = [
  "2 Garrick Drive, London NW4 1HJ",
  "4 Garrick Drive, London NW4 1HJ",
  "6 Garrick Drive, London NW4 1HJ",
  "8 Garrick Drive, London NW4 1HJ",
];

const plans = {
  value: { title: "Lower upfront cost", tag: "Best return", panels: 10, kwp: 4.55, battery: 5, inverter: "5 kW hybrid", price: 6950, generation: 4050, saving: 1091 },
  maximum: { title: "Higher annual savings", tag: "Maximise your roof", panels: 14, kwp: 6.37, battery: 10, inverter: "6 kW hybrid", price: 9950, generation: 5660, saving: 1438 },
};

const money = (value: number) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);

function Brand() {
  return <button className="brand" onClick={() => window.location.reload()} aria-label="Apollo Solar home"><span className="brand-mark">A</span><span>Apollo Solar</span></button>;
}

function Progress({ stage }: { stage: Stage }) {
  const current = stage === "find" ? 1 : stage === "roof" ? 2 : 3;
  return <div className="progress" aria-label={`Step ${current} of 3`}>
    {["Find your home", "See your roof", "Compare options"].map((label, i) => <div className={current >= i + 1 ? "active" : ""} key={label}><b>{current > i + 1 ? "✓" : i + 1}</b><span>{label}</span>{i < 2 && <i />}</div>)}
  </div>;
}

function RoofGraphic({ panels = 14 }: { panels?: number }) {
  return <div className="roof-scene" aria-label={`Illustrative roof with ${panels} solar panels`}>
    <div className="roof-label"><span>●</span> Roof found<br/><b>6 Garrick Drive</b></div>
    <div className="compass">N<br/><span>↑</span></div>
    <div className="roof-shape">{Array.from({ length: panels }).map((_, i) => <span className="panel" key={i} />)}</div>
    <div className="map-tag">Indicative roof preview</div>
  </div>;
}

export default function Home() {
  const [stage, setStage] = useState<Stage>("find");
  const [postcode, setPostcode] = useState("NW4 1HJ");
  const [searched, setSearched] = useState(false);
  const [address, setAddress] = useState("6 Garrick Drive, London NW4 1HJ");
  const [usage, setUsage] = useState(5000);
  const [editingUsage, setEditingUsage] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("value");
  const [form, setForm] = useState({ phone: "", email: "", time: "" });

  const adjustedPlans = useMemo(() => {
    const factor = Math.max(.86, Math.min(1.12, usage / 5000));
    return Object.fromEntries(Object.entries(plans).map(([key, plan]) => {
      const saving = Math.round(plan.saving * factor);
      return [key, { ...plan, saving, roi: saving / plan.price * 100, payback: plan.price / saving, benefit: saving * 25 - plan.price }];
    })) as Record<PlanKey, typeof plans.value & { roi: number; payback: number; benefit: number }>;
  }, [usage]);

  const findHome = () => { if (postcode.trim()) setSearched(true); };
  const chooseAddress = (item: string) => { setAddress(item); setStage("roof"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const book = (key: PlanKey) => { setSelectedPlan(key); setStage("booking"); window.scrollTo({ top: 0, behavior: "smooth" }); };
  const submit = (e: FormEvent) => { e.preventDefault(); setStage("complete"); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (stage === "find") return <main>
    <nav className="nav"><Brand /><span className="nav-note">60-second solar estimate</span></nav>
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><span /> Free home assessment</div>
        <h1>See what your roof could <em>save you.</em></h1>
        <p className="lede">Your roof, two clear solar options and an estimated payback period — in under 60 seconds.</p>
        <div className="hero-steps"><div><b>1</b><span><strong>Find your home</strong>Enter your postcode</span></div><i/><div><b>2</b><span><strong>See your roof</strong>Instant solar potential</span></div><i/><div><b>3</b><span><strong>Compare options</strong>Savings & payback</span></div></div>
        <div className="finder">
          <label htmlFor="postcode">Enter your postcode</label>
          <div className="finder-row"><input id="postcode" value={postcode} onChange={(e) => { setPostcode(e.target.value.toUpperCase()); setSearched(false); }} onKeyDown={(e) => e.key === "Enter" && findHome()} placeholder="e.g. NW4 1HJ"/><button onClick={findHome}>Find my home <span>→</span></button></div>
          {searched && <div className="address-list"><p>Select your address</p>{addresses.map(item => <button key={item} onClick={() => chooseAddress(item)}><span>{item}</span><b>→</b></button>)}</div>}
          <small><span>⌖</span> We use your address to estimate roof size and local energy use.</small>
        </div>
      </div>
      <div className="hero-visual"><div className="sun-glow"/><RoofGraphic/><div className="potential"><span>Estimated potential</span><strong>14 panels</strong><b>6.37 kWp</b></div></div>
    </section>
    <div className="trust-bar"><span>Built for UK homes</span><b>Address-led estimate</b><b>Two clear options</b><b>No obligation</b></div>
  </main>;

  if (stage === "roof") return <main className="app-shell">
    <nav className="nav"><Brand/><button className="text-button" onClick={() => setStage("find")}>← Change address</button></nav>
    <Progress stage={stage}/>
    <section className="roof-step">
      <div className="section-heading"><div className="eyebrow"><span/> Step 2 — Your roof</div><h2>We found your home.</h2><p>{address}</p></div>
      <div className="roof-grid">
        <div className="map-wrap"><RoofGraphic/><div className="demo-flag">Demo roof data</div></div>
        <div className="roof-details">
          <div className="found"><span>✓</span><div><b>Good solar potential</b><small>South & south-west facing roof sections detected</small></div></div>
          <div className="stat-grid"><div><small>Max. panels</small><strong>14</strong></div><div><small>System potential</small><strong>6.37 <em>kWp</em></strong></div><div><small>Est. generation</small><strong>5,660 <em>kWh/yr</em></strong></div><div><small>Roof type</small><strong>Pitched</strong></div></div>
          <div className="energy-card"><div><span>Estimated annual electricity use</span><small>Property-adjusted local estimate</small></div>{editingUsage ? <div className="usage-edit"><input type="number" min="1000" max="20000" value={usage} onChange={e => setUsage(Number(e.target.value))}/><span>kWh/year</span><button onClick={() => setEditingUsage(false)}>Use this</button></div> : <div className="usage-value"><strong>{usage.toLocaleString("en-GB")}</strong><span>kWh/year</span><button onClick={() => setEditingUsage(true)}>Edit</button></div>}<p>Based on the home type and typical electricity use near {postcode}. You can replace this with the customer&apos;s actual annual usage.</p></div>
          <button className="primary full" onClick={() => { setStage("options"); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Show my two solar options <span>→</span></button>
          <p className="fineprint">Indicative assessment only. Final panel positioning is confirmed after a technical survey.</p>
        </div>
      </div>
    </section>
  </main>;

  if (stage === "options") return <main className="app-shell options-bg">
    <nav className="nav"><Brand/><button className="text-button" onClick={() => setStage("roof")}>← Back to roof</button></nav>
    <Progress stage={stage}/>
    <section className="options-step">
      <div className="section-heading centered"><div className="eyebrow"><span/> Step 3 — Your options</div><h2>Two smart ways to go solar.</h2><p>One keeps the upfront cost lower. The other gets more from your roof.</p></div>
      <div className="context-line"><b>{address}</b><span>{usage.toLocaleString("en-GB")} kWh estimated use</span><span>14-panel roof potential</span></div>
      <div className="plan-grid">
        {(Object.keys(adjustedPlans) as PlanKey[]).map((key, index) => { const plan = adjustedPlans[key]; return <article className={`plan-card ${index === 0 ? "featured" : ""}`} key={key}>
          <div className="plan-top"><div><span className="option-label">Option {index + 1}</span><h3>{plan.title}</h3></div><span className="plan-tag">{plan.tag}</span></div>
          <div className="system-line"><div className="mini-panels">{Array.from({length:index ? 8 : 6}).map((_,i)=><i key={i}/>)}</div><div><strong>{plan.panels} × 455W panels</strong><span>{plan.kwp} kWp solar system</span></div></div>
          <div className="hardware"><span><b>{plan.battery} kWh</b> battery</span><span><b>{plan.inverter}</b> inverter</span></div>
          <div className="investment"><small>Indicative investment</small><strong>{money(plan.price)}</strong><span>0% VAT included</span></div>
          <div className="return-grid"><div><small>Estimated annual saving</small><strong>{money(plan.saving)}</strong><span>per year</span></div><div><small>Estimated annual return</small><strong>{plan.roi.toFixed(1)}%</strong></div><div><small>Indicative payback</small><strong>{plan.payback.toFixed(1)}</strong><span>years</span></div><div><small>25-year estimated benefit</small><strong>{money(plan.benefit)}</strong></div></div>
          <button className="primary full" onClick={() => book(key)}>Book a free survey for this option <span>→</span></button>
          <div className="warranty"><span>25 yr panel</span><span>10 yr battery</span><span>5 + 5 yr inverter</span></div>
        </article>; })}
      </div>
      <p className="assumption">Savings use standard household self-consumption and tariff assumptions. Your full proposal will use actual bills, tariff and detailed technical design.</p>
    </section>
  </main>;

  if (stage === "booking") { const plan = adjustedPlans[selectedPlan]; return <main className="app-shell booking-bg">
    <nav className="nav"><Brand/><button className="text-button" onClick={() => setStage("options")}>← Back to options</button></nav>
    <section className="booking-step">
      <div className="booking-summary"><div className="eyebrow"><span/> Your solar potential</div><h2>Ready for an accurate quote?</h2><p>A free on-site survey confirms your roof, electrical setup and final system design.</p><div className="summary-card"><small>Your selected starting point</small><h3>{plan.title}</h3><div><span>{plan.panels} panels · {plan.kwp} kWp</span><b>{money(plan.price)}</b></div><div><span>Estimated annual saving</span><b>{money(plan.saving)}</b></div><div><span>Indicative payback</span><b>{plan.payback.toFixed(1)} years</b></div></div><p className="address-note">⌖ {address}</p></div>
      <form className="booking-form" onSubmit={submit}><span className="form-kicker">Free technical survey</span><h3>Where should we contact you?</h3><p>No lengthy form. Just the details we need to arrange your visit.</p><label>Phone number <b>*</b><input required type="tel" placeholder="e.g. 07700 900000" value={form.phone} onChange={e => setForm({...form, phone:e.target.value})}/></label><label>Email address <b>*</b><input required type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({...form, email:e.target.value})}/></label><label>Preferred survey time <small>Optional</small><input placeholder="e.g. Weekday mornings" value={form.time} onChange={e => setForm({...form, time:e.target.value})}/></label><label className="consent"><input required type="checkbox"/><span>I agree to be contacted about this solar assessment and survey.</span></label><button className="primary full" type="submit">Book my free survey <span>→</span></button><small className="privacy">Your details are used only to arrange your solar consultation.</small></form>
    </section>
  </main>; }

  return <main className="complete"><div className="complete-mark">✓</div><div className="eyebrow"><span/> Survey request received</div><h2>Your roof is one step closer.</h2><p>We&apos;ll contact you using the details provided to arrange the free technical survey for:</p><strong>{address}</strong><div className="next-steps"><div><b>1</b><span><strong>We call or email</strong>Confirm a suitable appointment</span></div><div><b>2</b><span><strong>Technical survey</strong>Check the roof and electrical setup</span></div><div><b>3</b><span><strong>Your accurate proposal</strong>Final design, savings and price</span></div></div><button className="secondary" onClick={() => window.location.reload()}>Start another assessment</button><small>This is a demo — no information has been sent.</small></main>;
}
