import { getD1 } from "./runtime";
import { adminEmails } from "./provider-config";

export async function authorizeAdmin(user: { userId: string; email: string }) {
  const db = getD1();
  const localOwner = user.userId === "apollogrid-local-owner" && user.email === "owner@localhost";
  const configuredOwner = adminEmails().includes(user.email.toLowerCase());
  if (!localOwner && !configuredOwner) return { allowed: false, db };
  const count = await db.prepare("SELECT COUNT(*) AS count FROM admins").first<{ count: number }>();
  if (Number(count?.count ?? 0) === 0) {
    await db.prepare("INSERT OR IGNORE INTO admins (user_id, email) VALUES (?, ?)").bind(user.userId, user.email).run();
  }
  const admin = await db.prepare("SELECT user_id FROM admins WHERE user_id = ?").bind(user.userId).first();
  return { allowed: Boolean(admin), db };
}
