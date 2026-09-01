import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the APOLLOGRID assessment", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>APOLLOGRID \| Your roof\. Your savings\.<\/title>/i);
  assert.match(html, /See what your roof could/);
  assert.match(html, /Postcode electricity use comes from DESNZ 2024/);
  assert.match(html, /490W solar panels/);
});

test("keeps third-party credentials on server routes", async () => {
  const [page, assessmentRoute, solarRoute] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/assessment/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/solar/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /fetch\(`\/api\/solar\?lat=/);
  assert.doesNotMatch(page, /GOOGLE_MAPS_API_KEY|IDEAL_POSTCODES_API_KEY/);
  assert.match(assessmentRoute, /process\.env\.IDEAL_POSTCODES_API_KEY/);
  assert.match(solarRoute, /process\.env\.GOOGLE_MAPS_API_KEY/);
  assert.match(solarRoute, /requiredQuality: "BASE"/);
});
