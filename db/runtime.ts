import { env } from "cloudflare:workers";

export function getD1() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export async function ensureSchema() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS assessments (id TEXT PRIMARY KEY, postcode TEXT NOT NULL, address TEXT NOT NULL, annual_usage_kwh INTEGER NOT NULL, usage_source TEXT NOT NULL, panel_count INTEGER NOT NULL, panel_watts INTEGER NOT NULL, system_kwp REAL NOT NULL, annual_generation_kwh INTEGER NOT NULL, annual_bill_before REAL NOT NULL, annual_bill_solar_only REAL NOT NULL, annual_bill_solar_battery REAL NOT NULL, annual_benefit REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, assessment_id TEXT REFERENCES assessments(id), customer_name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL, preferred_time TEXT NOT NULL DEFAULT '', consent INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS pylon_comparisons (id TEXT PRIMARY KEY, assessment_id TEXT NOT NULL REFERENCES assessments(id), proposal_url TEXT NOT NULL DEFAULT '', pylon_annual_usage_kwh INTEGER NOT NULL, pylon_panel_count INTEGER NOT NULL, pylon_generation_kwh INTEGER NOT NULL, pylon_bill_before REAL NOT NULL, pylon_bill_after REAL NOT NULL, input_hit_rate REAL NOT NULL, generation_hit_rate REAL NOT NULL, benefit_hit_rate REAL NOT NULL, overall_hit_rate REAL NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS admins (user_id TEXT PRIMARY KEY, email TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS api_usage_events (id TEXT PRIMARY KEY, provider TEXT NOT NULL, endpoint TEXT NOT NULL, status_code INTEGER NOT NULL, success INTEGER NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_assessments_created_at ON assessments(created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_assessments_postcode ON assessments(postcode)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_leads_assessment_id ON leads(assessment_id)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_comparisons_assessment_id ON pylon_comparisons(assessment_id)`),
    db.prepare(`DELETE FROM pylon_comparisons WHERE rowid NOT IN (SELECT MAX(rowid) FROM pylon_comparisons GROUP BY assessment_id, proposal_url)`),
    db.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_comparisons_assessment_url ON pylon_comparisons(assessment_id, proposal_url)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage_events(created_at)`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_api_usage_provider_created_at ON api_usage_events(provider, created_at)`),
  ]);
  return db;
}

export async function recordApiUsage(provider: string, endpoint: string, statusCode: number, success: boolean) {
  try {
    const db = await ensureSchema();
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
