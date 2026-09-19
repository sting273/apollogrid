import fs from "node:fs/promises";
import { ENERGY_MODEL, simulateEnergy } from "../app/energyModel.ts";

const baseUrl = process.env.APOLLO_SITE_URL || "https://apollo-solar-assessment.guoyiding273.chatgpt.site";
const authToken = process.env.APOLLO_SITE_AUTH_TOKEN || "";
const outputPath = process.env.CALIBRATION_OUTPUT || "pylon-calibration-results.json";
const proposalUrls = [...new Set(process.argv.slice(2).filter(Boolean))];

if (!proposalUrls.length) {
  console.error("Usage: pnpm calibrate:pylon <proposal-url> [proposal-url ...]");
  process.exit(1);
}

const siteHeaders = authToken ? { "OAI-Sites-Authorization": `Bearer ${authToken}` } : {};
const clean = (value) => String(value ?? "").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&#39;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, " ").trim();
const normalise = (value) => clean(value).toUpperCase().replace(/[^A-Z0-9]/g, "");
const postcodeFrom = (value) => clean(value).toUpperCase().match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/)?.[0].replace(/\s+/g, " ") ?? "";
const hitRate = (ours, reference) => {
  if (!Number.isFinite(ours) || !Number.isFinite(reference) || reference === 0) return null;
  return Math.max(0, Math.min(100, (1 - Math.abs(ours - reference) / Math.max(Math.abs(reference), 1)) * 100));
};

function embeddedJson(html, marker) {
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error(`${marker.trim()} data was not found.`);
  const start = html.indexOf("{", markerIndex + marker.length);
  let depth = 0, quoted = false, escaped = false;
  for (let index = start; index < html.length; index += 1) {
    const char = html[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return JSON.parse(html.slice(start, index + 1));
  }
  throw new Error("Embedded proposal data was incomplete.");
}

function extractAddress(html) {
  const markerIndex = html.indexOf("Addressed to:");
  if (markerIndex < 0) return "";
  const fragment = html.slice(markerIndex, markerIndex + 1400)
    .replace(/<br[^>]*>/gi, ", ")
    .replace(/<[^>]+>/g, " ");
  return clean(fragment.match(/Addressed to:\s*(.*?)\s*Prepared by/i)?.[1] ?? "");
}

function annualLoad(proposal) {
  const energy = proposal.charts?.energy_profile ?? {};
  if (Number(energy.total_load) > 0) return Number(energy.total_load);
  const tariffLoad = Object.values(energy.per_tariff ?? {}).reduce((sum, item) => sum + Number(item?.total_load ?? 0), 0);
  if (tariffLoad > 0) return tariffLoad;
  return (energy.typical_year ?? []).reduce((sum, month) => sum + Number(month?.load_consumption ?? 0), 0);
}

async function siteJson(path) {
  const response = await fetch(new URL(path, baseUrl), { headers: siteHeaders });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Site API returned ${response.status}.`);
  return body;
}

async function calibrate(proposalUrl) {
  const response = await fetch(proposalUrl, { headers: { "User-Agent": "Apollogrid batch calibration" } });
  if (!response.ok) throw new Error(`Pylon returned ${response.status}.`);
  const html = await response.text();
  const proposal = embeddedJson(html, "window.Proposal = ");
  const address = extractAddress(html);
  const postcode = postcodeFrom(address);
  if (!address || !postcode) throw new Error("Customer address or postcode was not found.");

  const lookup = await siteJson(`/api/assessment?postcode=${encodeURIComponent(postcode)}`);
  const addressStem = normalise(address.replace(postcode, "").split(",")[0]);
  const matchedAddress = lookup.addressLookup?.addresses?.find((item) => normalise(item.formatted).startsWith(addressStem))
    ?? lookup.addressLookup?.addresses?.[0]
    ?? { formatted: address, latitude: lookup.latitude, longitude: lookup.longitude };

  let solar = null;
  let solarSource = "Google Solar";
  try {
    solar = await siteJson(`/api/solar?lat=${encodeURIComponent(matchedAddress.latitude)}&lon=${encodeURIComponent(matchedAddress.longitude)}`);
  } catch {
    solarSource = "880 kWh/kWp fallback";
  }

  const ourUsage = Math.round(Number(lookup.electricity?.medianKwh || 5000));
  const annualYieldPerKwp = Number(solar?.annualYieldPerKwp || 880);
  const maxPanels = Number(solar?.maxPanels || 14);
  const ourPanels = Math.min(maxPanels, Math.max(1, Math.ceil(ourUsage / (0.49 * annualYieldPerKwp))));
  const ourGeneration = Math.round(ourPanels * 0.49 * annualYieldPerKwp * ENERGY_MODEL.deliveredEnergyFactor);
  const ourEnergy = simulateEnergy({ annualUsageKwh: ourUsage, annualGenerationKwh: ourGeneration, batteryEnabled: true });

  const energy = proposal.charts?.energy_profile ?? {};
  const pylonUsage = Math.round(annualLoad(proposal));
  const pylonPanels = (proposal.panels ?? []).reduce((sum, panel) => sum + Number(panel.count ?? 0), 0);
  const pylonGeneration = Math.round(Number(proposal.annual_production || energy.total_solar_production || 0));
  const pylonBillBefore = Number(proposal.charts?.monthly_expenses?.annual_bill || 0);
  const pylonBillAfter = Number(proposal.charts?.yearly_expenses?.with_solar?.[0]
    ?? (proposal.charts?.monthly_expenses?.with_solar ?? []).reduce((sum, value) => sum + Number(value), 0));
  const pylonBenefit = pylonBillBefore - pylonBillAfter;

  const usageHit = hitRate(ourUsage, pylonUsage);
  const panelHit = pylonPanels > 0 ? hitRate(ourPanels, pylonPanels) : null;
  const inputParts = [usageHit, panelHit].filter(Number.isFinite);
  const inputHit = inputParts.length ? inputParts.reduce((a, b) => a + b, 0) / inputParts.length : null;
  const generationHit = pylonGeneration > 0 ? hitRate(ourGeneration, pylonGeneration) : null;
  const benefitHit = hitRate(ourEnergy.annualBenefit, pylonBenefit);
  const weighted = [[inputHit, 0.2], [generationHit, 0.4], [benefitHit, 0.4]].filter(([score]) => Number.isFinite(score));
  const overallHit = weighted.reduce((sum, [score, weight]) => sum + score * weight, 0) / weighted.reduce((sum, [, weight]) => sum + weight, 0);

  return {
    proposalUrl, address, postcode, matchedAddress: matchedAddress.formatted, comparisonStatus: pylonPanels ? "Full solar + battery comparison" : "Partial comparison: battery-only Pylon proposal",
    solarSource, usageSource: lookup.electricity ? `${lookup.electricity.scope} · DESNZ ${lookup.electricity.year}` : "fallback",
    pylon: { annualUsageKwh: pylonUsage, panelCount: pylonPanels, systemKwp: Number(proposal.size || 0), batteryKwh: Number(proposal.storage_size || 0), annualGenerationKwh: pylonGeneration, annualBillBefore: pylonBillBefore, annualBillAfter: pylonBillAfter, annualBenefit: pylonBenefit, caseImageUrl: proposal.snapshots?.string?.replace("-annotations.jpeg", "-layout.jpeg") || "" },
    ours: { annualUsageKwh: ourUsage, panelCount: ourPanels, panelWatts: 490, systemKwp: ourPanels * 0.49, annualGenerationKwh: ourGeneration, annualBillBefore: ourEnergy.annualBillBefore, annualBillAfter: ourEnergy.annualBillAfter, annualBenefit: ourEnergy.annualBenefit },
    hitRates: { usage: usageHit, panels: panelHit, input: inputHit, generation: generationHit, benefit: benefitHit, overall: overallHit },
  };
}

const results = [];
for (const proposalUrl of proposalUrls) {
  try {
    console.log(`Calibrating ${proposalUrl}`);
    results.push(await calibrate(proposalUrl));
  } catch (error) {
    results.push({ proposalUrl, error: error instanceof Error ? error.message : String(error) });
  }
}

await fs.writeFile(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), baseUrl, submittedCount: process.argv.slice(2).filter(Boolean).length, uniqueCount: proposalUrls.length, results }, null, 2));
console.log(`Saved ${results.length} unique result(s) to ${outputPath}`);
