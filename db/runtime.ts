import { env } from "cloudflare:workers";

export function getD1() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function recordApiUsage(provider: string, endpoint: string, statusCode: number, success: boolean) {
  try {
    const db = getD1();
    await db.prepare("INSERT INTO api_usage_events (id, provider, endpoint, status_code, success) VALUES (?, ?, ?, ?, ?)")
      .bind(crypto.randomUUID(), provider, endpoint, statusCode, success ? 1 : 0).run();
  } catch {
    // Analytics must never block the customer-facing calculation.
  }
}

export function hitRate(ours: number, reference: number) {
  if (!Number.isFinite(ours) || !Number.isFinite(reference)) return 0;
  const scale = Math.max(Math.abs(reference), 1);
  return Math.max(0, Math.min(100, (1 - Math.abs(ours - reference) / scale) * 100));
}
