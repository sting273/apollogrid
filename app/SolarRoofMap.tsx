"use client";

import { useEffect, useRef, useState } from "react";

type SolarPanel = {
  center: { latitude: number; longitude: number };
  orientation: "LANDSCAPE" | "PORTRAIT";
  azimuthDegrees: number;
};

type Props = {
  imageryUrl: string;
  panels: SolarPanel[];
  panelCount: number;
  label: string;
};

export default function SolarRoofMap({ imageryUrl, panels, panelCount, label }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const response = await fetch(imageryUrl);
        if (!response.ok) throw new Error("Imagery unavailable");
        const [{ fromArrayBuffer }, { toProj4 }, { default: proj4 }] = await Promise.all([
          import("geotiff"),
          import("geotiff-geokeys-to-proj4"),
          import("proj4"),
        ]);
        const tiff = await fromArrayBuffer(await response.arrayBuffer());
        const image = await tiff.getImage();
        const rasters = await image.readRasters();
        const width = rasters.width;
        const height = rasters.height;
        if (cancelled || rasters.length < 3) return;

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) throw new Error("Canvas unavailable");
        canvas.width = width;
        canvas.height = height;
        const pixels = context.createImageData(width, height);
        const red = rasters[0];
        const green = rasters[1];
        const blue = rasters[2];
        for (let index = 0; index < width * height; index += 1) {
          const pixel = index * 4;
          pixels.data[pixel] = Number(red[index]);
          pixels.data[pixel + 1] = Number(green[index]);
          pixels.data[pixel + 2] = Number(blue[index]);
          pixels.data[pixel + 3] = 255;
        }
        context.putImageData(pixels, 0, 0);

        const projectionData = toProj4(image.getGeoKeys());
        const projection = proj4(projectionData.proj4, "WGS84");
        const box = image.getBoundingBox();
        const convert = (x: number, y: number) => projection.forward({
          x: x * projectionData.conversionParameters.x,
          y: y * projectionData.conversionParameters.y,
        });
        const southWest = convert(box[0], box[1]);
        const northEast = convert(box[2], box[3]);
        const west = Math.min(southWest.x, northEast.x);
        const east = Math.max(southWest.x, northEast.x);
        const south = Math.min(southWest.y, northEast.y);
        const north = Math.max(southWest.y, northEast.y);
        const horizontalMeters = Math.max((east - west) * 111_320 * Math.cos(((north + south) / 2) * Math.PI / 180), 1);
        const verticalMeters = Math.max((north - south) * 111_320, 1);
        const panelWidthPixels = 1.13 / horizontalMeters * width;
        const panelHeightPixels = 1.8 / verticalMeters * height;

        for (const panel of panels.slice(0, panelCount)) {
          const x = (panel.center.longitude - west) / (east - west) * width;
          const y = (north - panel.center.latitude) / (north - south) * height;
          const landscape = panel.orientation === "LANDSCAPE";
          const drawWidth = landscape ? panelHeightPixels : panelWidthPixels;
          const drawHeight = landscape ? panelWidthPixels : panelHeightPixels;
          context.save();
          context.translate(x, y);
          context.rotate(panel.azimuthDegrees * Math.PI / 180);
          context.fillStyle = "rgba(17, 43, 58, .88)";
          context.strokeStyle = "rgba(255, 255, 255, .95)";
          context.lineWidth = Math.max(1, width / 350);
          context.fillRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          context.strokeRect(-drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
          context.restore();
        }
        if (!cancelled) setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }

    render();
    return () => { cancelled = true; };
  }, [imageryUrl, panelCount, panels]);

  return <div className="solar-roof-map" aria-label={`Google Solar aerial roof layout with ${panelCount} proposed panels`}>
    <canvas ref={canvasRef}/>
    {status === "loading" && <div className="solar-map-status"><span/>Loading Google Solar imagery…</div>}
    {status === "error" && <div className="solar-map-status error">Satellite layer unavailable</div>}
    <div className="roof-label"><span>●</span> Roof location<br/><b>{label}</b></div>
    <div className="compass">N<br/><span>↑</span></div>
    <div className="map-tag">Google Solar aerial imagery · indicative 490W layout</div>
  </div>;
}
