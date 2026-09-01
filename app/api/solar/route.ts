const PANEL_WATTS = 490;
const PANEL_AREA_METERS2 = 1.8 * 1.13;

type GoogleSolarResponse = {
  imageryQuality?: "HIGH" | "MEDIUM" | "BASE";
  imageryDate?: { year?: number; month?: number; day?: number };
  solarPotential?: {
    maxArrayPanelsCount?: number;
    maxArrayAreaMeters2?: number;
    maxSunshineHoursPerYear?: number;
    panelCapacityWatts?: number;
    panelHeightMeters?: number;
    panelWidthMeters?: number;
    wholeRoofStats?: { areaMeters2?: number };
    solarPanelConfigs?: Array<{ panelsCount?: number; yearlyEnergyDcKwh?: number }>;
    roofSegmentStats?: Array<{ pitchDegrees?: number; azimuthDegrees?: number; stats?: { areaMeters2?: number } }>;
  };
  error?: { message?: string; status?: string };
};

type RoofSegment = {
  pitchDegrees?: number;
  azimuthDegrees?: number;
  stats?: { areaMeters2?: number };
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return Response.json({ error: "Valid building coordinates are required." }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) return Response.json({ error: "Google Solar is not configured." }, { status: 503 });

  const googleParams = new URLSearchParams({
    "location.latitude": latitude.toString(),
    "location.longitude": longitude.toString(),
    requiredQuality: "BASE",
    key: apiKey,
  });
  const response = await fetch(`https://solar.googleapis.com/v1/buildingInsights:findClosest?${googleParams}`, { cache: "no-store" });
  const payload = await response.json() as GoogleSolarResponse;
  if (!response.ok || !payload.solarPotential) {
    return Response.json({ error: payload.error?.message ?? "No Google Solar building match was found." }, { status: response.status || 404 });
  }

  const potential = payload.solarPotential;
  const configs = potential.solarPanelConfigs ?? [];
  const largestConfig = configs.reduce<{ panelsCount?: number; yearlyEnergyDcKwh?: number } | null>((best, item) => !best || (item.panelsCount ?? 0) > (best.panelsCount ?? 0) ? item : best, null);
  const googlePanelWatts = potential.panelCapacityWatts ?? 400;
  const googlePanels = largestConfig?.panelsCount ?? potential.maxArrayPanelsCount ?? 0;
  const annualYieldPerKwp = googlePanels > 0 && (largestConfig?.yearlyEnergyDcKwh ?? 0) > 0
    ? (largestConfig!.yearlyEnergyDcKwh! / (googlePanels * googlePanelWatts / 1000))
    : 880;
  const maxByArea = Math.floor((potential.maxArrayAreaMeters2 ?? 0) / PANEL_AREA_METERS2);
  const maxPanels = Math.max(1, Math.min(potential.maxArrayPanelsCount ?? maxByArea, maxByArea || potential.maxArrayPanelsCount || 1));
  const dominantRoof = (potential.roofSegmentStats ?? []).reduce<RoofSegment | null>((best, item) => !best || (item.stats?.areaMeters2 ?? 0) > (best.stats?.areaMeters2 ?? 0) ? item : best, null);

  return Response.json({
    matched: true,
    panelWatts: PANEL_WATTS,
    maxPanels,
    annualYieldPerKwp: Math.round(annualYieldPerKwp),
    maxArrayAreaMeters2: potential.maxArrayAreaMeters2 ?? null,
    roofAreaMeters2: potential.wholeRoofStats?.areaMeters2 ?? null,
    maxSunshineHoursPerYear: potential.maxSunshineHoursPerYear ?? null,
    roofPitchDegrees: dominantRoof?.pitchDegrees ?? null,
    roofAzimuthDegrees: dominantRoof?.azimuthDegrees ?? null,
    imageryQuality: payload.imageryQuality ?? "BASE",
    imageryDate: payload.imageryDate ?? null,
  }, { headers: { "Cache-Control": "private, no-store" } });
}
