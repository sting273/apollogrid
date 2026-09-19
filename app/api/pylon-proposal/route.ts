import { getChatGPTUser } from "../../chatgpt-auth";
import { authorizeAdmin } from "../../../db/admin";
import { recordApiUsage } from "../../../db/runtime";

type Proposal = {
  charts?: {
    energy_profile?: { total_load?: number; total_solar_production?: number };
    monthly_expenses?: { annual_bill?: number; with_solar?: number[] };
    yearly_expenses?: { with_solar?: number[] };
  };
  panels?: Array<{ count?: number; power?: number; name?: string }>;
  annual_production?: number;
  size?: number;
  storage_size?: number;
};

function proposalJson(html: string) {
  const marker = "window.Proposal = ";
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) throw new Error("Proposal data was not found on this page.");
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
    else if (char === "}" && --depth === 0) return JSON.parse(html.slice(start, index + 1)) as Proposal;
  }
  throw new Error("Proposal data was incomplete.");
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Sign in required." }, { status: 401 });
  const { allowed } = await authorizeAdmin(user);
  if (!allowed) return Response.json({ error: "Admin access required." }, { status: 403 });
  const body = await request.json() as { proposalUrl?: string };
  let url: URL;
  try { url = new URL(body.proposalUrl ?? ""); } catch { return Response.json({ error: "Enter a valid Pylon proposal URL." }, { status: 400 }); }
  if (url.protocol !== "https:" || url.hostname !== "app.getpylon.com" || !/^\/proposals\/[A-Za-z0-9_-]+\/?$/.test(url.pathname)) return Response.json({ error: "Only app.getpylon.com/proposals links can be parsed." }, { status: 400 });
  const response = await fetch(url, { redirect: "manual", headers: { "User-Agent": "Apollogrid calibration service" } });
  await recordApiUsage("Pylon", "Proposal parser", response.status, response.ok);
  if (!response.ok) return Response.json({ error: `Pylon returned ${response.status}.` }, { status: 502 });
  try {
    const p = proposalJson(await response.text());
    const energy = p.charts?.energy_profile ?? {};
    const annualUsage = Number(energy.total_load ?? 0);
    const panelCount = Array.isArray(p.panels) ? p.panels.reduce((sum: number, item: { count?: number }) => sum + Number(item.count ?? 0), 0) : 0;
    const annualGeneration = Number(p.annual_production ?? 0);
    const billBefore = Number(p.charts?.monthly_expenses?.annual_bill ?? 0);
    const billAfter = Number(p.charts?.yearly_expenses?.with_solar?.[0] ?? (p.charts?.monthly_expenses?.with_solar ?? []).reduce((sum: number, value: number) => sum + Number(value), 0));
    if (![annualUsage, panelCount, annualGeneration, billBefore, billAfter].every(Number.isFinite) || !annualUsage || !panelCount || !annualGeneration) throw new Error("The proposal is missing one or more comparison fields.");
    return Response.json({
      annualUsageKwh: Math.round(annualUsage), panelCount, annualGenerationKwh: Math.round(annualGeneration), billBefore, billAfter,
      systemKwp: Number(p.size ?? 0), batteryKwh: Number(p.storage_size ?? 0), internalProfileGenerationKwh: Math.round(Number(energy.total_solar_production ?? annualGeneration)),
      panelDescription: Array.isArray(p.panels) ? p.panels.map((item: { count?: number; power?: number; name?: string }) => `${item.count ?? 0} × ${item.power ?? 0}W ${item.name ?? "panel"}`).join(", ") : "",
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to parse this proposal." }, { status: 422 });
  }
}
