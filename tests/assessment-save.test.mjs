import assert from "node:assert/strict";
import test from "node:test";
import { saveAssessment } from "../app/saveAssessment.ts";

test("saves an assessment without survey/contact details and retries the same ID", async () => {
  const calls = [];
  const body = { id: "restore-test", postcode: "KT3 4LG", address: "Test address" };
  const result = await saveAssessment(body, async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) throw new TypeError("Network unavailable");
    if (calls.length === 2) return new Response("Unavailable", { status: 503 });
    return Response.json({ id: body.id }, { status: 201 });
  });
  assert.equal(result.id, body.id);
  assert.equal(calls.length, 3);
  for (const { url, options } of calls) {
    assert.equal(url, "/api/assessments");
    assert.deepEqual(JSON.parse(options.body), body);
    assert.equal(options.keepalive, true);
  }
});

test("does not retry invalid input, and reports exhausted transient failures", async () => {
  let count = 0;
  await assert.rejects(saveAssessment({}, async () => {
    count++;
    return new Response("Invalid", { status: 400 });
  }), /check the inputs/);
  assert.equal(count, 1);
  count = 0;
  await assert.rejects(saveAssessment({}, async () => {
    count++;
    return new Response("Unavailable", { status: 503 });
  }), /retry/);
  assert.equal(count, 3);
});
