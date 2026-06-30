import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:8000';
const errors = [];
const failed = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on('pageerror', (err) => errors.push(`PAGE: ${err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`);
});
page.on('requestfailed', (req) => {
  failed.push(`${req.failure()?.errorText || 'failed'}: ${req.url()}`);
});

for (const path of ['/pc.html', '/index.html']) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(1500);

  const boot = await page.evaluate(() => ({
    title: document.title,
    cards: document.querySelectorAll('.bey-card').length,
    canvas: Boolean(document.getElementById('game-canvas')),
  }));
  console.log(`BOOT ${path}:`, JSON.stringify(boot));

  const reqs = await page.evaluate(() =>
    performance.getEntriesByType('resource').map((r) => r.name)
  );
  const cdn = reqs.filter((u) => u.includes('jsdelivr'));
  const vendor = reqs.filter((u) => u.includes('/vendor/'));
  console.log(`DEPS ${path}: CDN=${cdn.length} vendor=${vendor.length}`);
  if (cdn.length > 0) {
    console.error(`FAIL: ${path} still loads CDN dependencies`);
    process.exitCode = 1;
  }
}

await page.goto(`${BASE}/pc.html`, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(1000);

for (let i = 0; i < 12; i++) {
  const onStriker = await page.evaluate(() =>
    document.querySelector('.bey-card.active .bey-name')?.textContent?.includes('RAY STRIKER')
  );
  if (onStriker) break;
  await page.click('.carousel-arrow.right');
  await page.waitForTimeout(150);
}

const canSelect = await page.evaluate(() => {
  const btn = document.querySelector('.bey-card.active .bey-select-btn');
  return Boolean(btn && !btn.disabled);
});
if (canSelect) {
  await page.click('.bey-card.active .bey-select-btn');
  await page.waitForTimeout(400);
  console.log('Selected Ray Striker');
} else {
  console.log('SKIP: active bey select button unavailable');
}

if (failed.length) {
  console.log('FAILED REQUESTS:');
  failed.forEach((f) => console.log(' ', f));
  process.exitCode = 1;
}
if (errors.length) {
  console.log('ERRORS:');
  errors.forEach((e) => console.log(' ', e));
  process.exitCode = 1;
} else {
  console.log('OK: local site verification passed');
}

await browser.close();
