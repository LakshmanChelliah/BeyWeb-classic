import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:8000/pc.html';
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

await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(2000);

const state = await page.evaluate(() => ({
  title: document.title,
  selectHidden: document.getElementById('select-overlay')?.classList.contains('hidden'),
  selectTitle: document.querySelector('.select-title')?.textContent?.trim() || null,
  playSetupHtml: document.getElementById('play-setup')?.innerHTML?.length || 0,
  carouselCards: document.querySelectorAll('.bey-card').length,
  canvas: Boolean(document.getElementById('game-canvas')),
  bodyBg: getComputedStyle(document.body).backgroundColor,
}));

console.log('URL:', URL);
console.log('DOM:', JSON.stringify(state, null, 2));
if (failed.length) {
  console.log('FAILED REQUESTS:');
  failed.forEach((f) => console.log(' ', f));
}
if (errors.length) {
  console.log('ERRORS:');
  errors.forEach((e) => console.log(' ', e));
  process.exitCode = 1;
} else if (!state.selectTitle && state.carouselCards === 0) {
  console.log('WARN: selection UI did not render');
  process.exitCode = 1;
} else {
  console.log('OK: page bootstrapped');
}

await browser.close();
