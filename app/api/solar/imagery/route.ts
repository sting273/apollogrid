import { providerSecret } from "../../../../db/provider-config";
import { recordApiUsage } from "../../../../db/runtime";

type DataLayersResponse = {
  rgbUrl?: string;
  error?: { message?: string };
};

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const latitude = Number(params.get("lat"));
  const longitude = Number(params.get("lon"));
  if (!params.get("lat")?.trim() || !params.get("lon")?.trim() || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    return Response.json({ error: "Valid building coordinates are required." }, { status: 400 });
  }

  const apiKey = providerSecret("GOOGLE_MAPS_API_KEY", process.env.GOOGLE_MAPS_API_KEY);
  if (!apiKey) return Response.json({ error: "Google Solar is not configured." }, { status: 503 });

  const layerParams = new URLSearchParams({
    "location.latitude": latitude.toString(),
    "location.longitude": longitude.toString(),
    radiusMeters: "30",
    view: "IMAGERY_LAYERS",
    requiredQuality: "BASE",
    pixelSizeMeters: "0.25",
    key: apiKey,
  });
  const layerResponse = await fetch(`https://solar.googleapis.com/v1/dataLayers:get?${layerParams}`, { cache: "no-store" });
  await recordApiUsage("Google Solar", "Data Layers", layerResponse.status, layerResponse.ok);
  const layers = await layerResponse.json() as DataLayersResponse;
  if (!layerResponse.ok || !layers.rgbUrl) {
    return Response.json({ error: layers.error?.message ?? "Google Solar imagery was unavailable." }, { status: layerResponse.ok ? 404 : layerResponse.status });
  }

  const imageryUrl = new URL(layers.rgbUrl);
  imageryUrl.searchParams.set("key", apiKey);
  const imageryResponse = await fetch(imageryUrl, { cache: "no-store" });
  await recordApiUsage("Google Solar", "Imagery download", imageryResponse.status, imageryResponse.ok);
  if (!imageryResponse.ok) {
    return Response.json({ error: "Google Solar imagery could not be downloaded." }, { status: imageryResponse.status });
  }

  return new Response(imageryResponse.body, {
    headers: {
      "Content-Type": imageryResponse.headers.get("content-type") || "image/tiff",
      "Cache-Control": "private, max-age=86400",
    },
  });
}
