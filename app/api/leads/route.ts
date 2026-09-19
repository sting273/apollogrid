import { getD1 } from "../../../db/runtime";

export async function POST(request: Request) {
  const body = await request.json() as Record<string, unknown>;
  const customerName = String(body.customerName ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const consent = body.consent === true;
  if (!customerName || !phone || !/^\S+@\S+\.\S+$/.test(email) || !consent) return Response.json({ error: "Complete the required contact fields and consent." }, { status: 400 });
  const id = crypto.randomUUID();
  const db = getD1();
  await db.prepare(`INSERT INTO leads (id, assessment_id, customer_name, phone, email, preferred_time, consent) VALUES (?, ?, ?, ?, ?, ?, 1)`)
    .bind(id, String(body.assessmentId ?? "") || null, customerName.slice(0, 120), phone.slice(0, 80), email.slice(0, 180), String(body.preferredTime ?? "").slice(0, 180)).run();
  return Response.json({ id }, { status: 201 });
}
