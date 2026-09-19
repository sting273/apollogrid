/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS allows a local Playwright module path on Windows. */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  fs.mkdirSync('local-logs', { recursive: true });
  try {
    await page.goto('http://127.0.0.1:3000/');
    await page.getByLabel('House number or name').waitFor({ timeout: 60000 });
    const lookup = page.waitForResponse(r => r.url().includes('/api/assessment?postcode=BR51AA') && r.status() === 200);
    await page.getByLabel('Enter your postcode').fill('BR5 1AA');
    await lookup;
    await page.getByLabel('House number or name').waitFor({ timeout: 60000 });
    assert.equal(await page.getByLabel('Enter your postcode').inputValue(), 'BR5 1AA');
    assert.ok((await page.getByLabel('House number or name').boundingBox()).width > 150);
    await page.screenshot({ path: 'local-logs/frontend.png', fullPage: true });
    await page.getByLabel('House number or name').fill('LOCAL RESTORE CHECK');
    await page.getByRole('button', { name: 'Continue →', exact: true }).click();
    await page.getByRole('button', { name: /Calculate my yearly savings/ }).waitFor();
    assert.match(await page.locator('body').innerText(), /Fallback annual yield/);
    const saved = page.waitForResponse(r => r.url().endsWith('/api/assessments') && r.status() === 201);
    await page.getByRole('button', { name: /Calculate my yearly savings/ }).click();
    const assessment = await (await saved).json();
    fs.writeFileSync('local-logs/smoke-assessment.json', JSON.stringify(assessment));
    await page.getByRole('button', { name: /Book a free technical survey/ }).waitFor();
    await page.screenshot({ path: 'local-logs/calculation.png', fullPage: true });
    await page.goto('http://127.0.0.1:3000/admin?period=all');
    await page.getByRole('heading', { name: 'Assessment operations' }).waitFor();
    assert.match(await page.locator('body').innerText(), /LOCAL RESTORE CHECK/);
    await page.screenshot({ path: 'local-logs/admin.png', fullPage: true });
    const exported = await page.request.get('http://127.0.0.1:3000/api/admin/export');
    assert.equal(exported.status(), 200);
    assert.match(await exported.text(), /LOCAL RESTORE CHECK/);
    const denied = await page.request.post('http://127.0.0.1:3000/api/assessments', {
      headers: { origin: 'https://example.com' }, data: {},
    });
    assert.equal(denied.status(), 403);
    assert.deepEqual(errors, []);
    console.log('PASS: postcode lookup, fallback calculation, database save, admin, export, origin protection, no browser exceptions.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
