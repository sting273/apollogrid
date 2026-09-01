const DESNZ_CSV = "https://assets.publishing.service.gov.uk/media/694282a1fdbd8404f9e1f1da/Postcode_level_all_meters_electricity_2024.csv";
const DESNZ_CSV_BYTES = 80_494_341;

type ElectricityRow = {
  meters: number;
  meanKwh: number;
  medianKwh: number;
  scope: "postcode" | "outcode";
};

function normalisePostcode(value: string) {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return compact.length > 3 ? `${compact.slice(0, -3)} ${compact.slice(-3)}` : compact;
}

function compare(a: string, b: string) {
  return a === b ? 0 : a < b ? -1 : 1;
}

async function rowAfterByte(byte: number) {
  const end = Math.min(byte + 8_191, DESNZ_CSV_BYTES - 1);
  const response = await fetch(DESNZ_CSV, {
    headers: { Range: `bytes=${byte}-${end}` },
  });
  if (!response.ok && response.status !== 206) throw new Error("DESNZ data unavailable");

  const text = await response.text();
  const lineStart = byte === 0 ? 0 : text.indexOf("\n") + 1;
  if (lineStart <= 0 || lineStart >= text.length) return null;
  const lineEnd = text.indexOf("\n", lineStart);
  if (lineEnd < 0) return null;

  return {
    line: text.slice(lineStart, lineEnd).replace(/\r$/, ""),
    start: byte + lineStart,
    end: byte + lineEnd + 1,
  };
}

async function lookupDesnzRow(targetOutcode: string, targetPostcode: string | null) {
  let low = 0;
  let high = DESNZ_CSV_BYTES - 1;

  for (let attempt = 0; attempt < 32 && low <= high; attempt += 1) {
    const row = await rowAfterByte(Math.floor((low + high) / 2));
    if (!row) break;
    const [outcode, rowPostcode, meters, , mean, median] = row.line.split(",");
    if (!outcode || !rowPostcode) break;

    const outcodeComparison = compare(outcode, targetOutcode);
    const rowPostcodeKey = rowPostcode === "All postcodes" ? "" : rowPostcode;
    const postcodeComparison = compare(rowPostcodeKey, targetPostcode ?? "");
    const comparison = outcodeComparison || postcodeComparison;

    if (comparison === 0) {
      return {
        meters: Number(meters),
        meanKwh: Number(mean),
        medianKwh: Number(median),
      };
    }
    if (comparison < 0) low = row.end;
    else high = row.start - 1;
  }
  return null;
}

async function lookupElectricity(postcode: string): Promise<ElectricityRow | null> {
  const outcode = postcode.split(" ")[0];
  const postcodeRow = await lookupDesnzRow(outcode, postcode);
  if (postcodeRow) return { ...postcodeRow, scope: "postcode" };
  const outcodeRow = await lookupDesnzRow(outcode, null);
  return outcodeRow ? { ...outcodeRow, scope: "outcode" } : null;
}

async function lookupAddresses(postcode: string) {
  const apiKey = process.env.IDEAL_POSTCODES_API_KEY?.trim();
  if (!apiKey) return { configured: false, addresses: [] as string[] };

  const response = await fetch(`https://api.ideal-postcodes.co.uk/v1/postcodes/${encodeURIComponent(postcode)}?api_key=${encodeURIComponent(apiKey)}`);
  if (!response.ok) return { configured: true, addresses: [] as string[] };
  const payload = await response.json() as { result?: Array<{ line_1?: string; line_2?: string; line_3?: string; post_town?: string; postcode?: string }> };
  const addresses = (payload.result ?? []).map((item) => [item.line_1, item.line_2, item.line_3, item.post_town, item.postcode].filter(Boolean).join(", "));
  return { configured: true, addresses };
}

export async function GET(request: Request) {
  const postcode = normalisePostcode(new URL(request.url).searchParams.get("postcode") ?? "");
  if (!/^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/.test(postcode)) {
    return Response.json({ error: "Enter a complete UK postcode." }, { status: 400 });
  }

  const locationResponse = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
  if (!locationResponse.ok) return Response.json({ error: "We could not find that postcode." }, { status: 404 });
  const locationPayload = await locationResponse.json() as { result: { postcode: string; latitude: number; longitude: number; region: string | null; admin_district: string | null } };

  const [electricity, addressLookup] = await Promise.all([
    lookupElectricity(locationPayload.result.postcode).catch(() => null),
    lookupAddresses(locationPayload.result.postcode).catch(() => ({ configured: Boolean(process.env.IDEAL_POSTCODES_API_KEY), addresses: [] as string[] })),
  ]);

  return Response.json({
    postcode: locationPayload.result.postcode,
    latitude: locationPayload.result.latitude,
    longitude: locationPayload.result.longitude,
    region: locationPayload.result.region,
    district: locationPayload.result.admin_district,
    electricity: electricity ? { ...electricity, year: 2024, source: "DESNZ" } : null,
    addressLookup,
  }, { headers: { "Cache-Control": addressLookup.configured ? "private, max-age=300" : "public, max-age=86400, s-maxage=604800" } });
}
