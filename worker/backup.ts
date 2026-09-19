type BackupEnv = {
  DB: D1Database;
  RESEND_API_KEY?: string;
  BACKUP_EMAIL_TO?: string;
  BACKUP_FROM_EMAIL?: string;
};

const TABLES = ["assessments", "leads", "pylon_comparisons", "api_usage_events", "admins"] as const;

/**
 * Creates a portable JSON backup and emails it through Resend. This is suited
 * to the current small operational dataset; the run deliberately fails loudly
 * once the attachment becomes too large for email delivery.
 */
export async function sendDailyBackup(env: BackupEnv) {
  const { RESEND_API_KEY, BACKUP_EMAIL_TO, BACKUP_FROM_EMAIL } = env;
  if (!RESEND_API_KEY || !BACKUP_EMAIL_TO || !BACKUP_FROM_EMAIL) {
    throw new Error("Daily backup secrets are not fully configured");
  }

  const data: Record<string, unknown[]> = {};
  for (const table of TABLES) {
    const result = await env.DB.prepare(`SELECT * FROM ${table} ORDER BY created_at ASC`).all<Record<string, unknown>>();
    data[table] = result.results;
  }

  const createdAt = new Date().toISOString();
  const document = JSON.stringify({ format: "apollogrid-backup/v1", createdAt, data });
  const encoded = btoa(unescape(encodeURIComponent(document)));
  if (encoded.length > 18_000_000) throw new Error("Backup is too large for email; move snapshots to R2");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: BACKUP_FROM_EMAIL,
      to: [BACKUP_EMAIL_TO],
      subject: `ApolloGrid data backup — ${createdAt.slice(0, 10)}`,
      text: `Automated ApolloGrid backup created at ${createdAt}. Keep the attachment private: it contains customer information.`,
      attachments: [{ filename: `apollogrid-backup-${createdAt.slice(0, 10)}.json`, content: encoded }],
    }),
  });
  if (!response.ok) throw new Error(`Backup email failed with HTTP ${response.status}`);
}
