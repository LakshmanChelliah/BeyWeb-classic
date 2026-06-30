import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (err) => {
  console.log('PAGE ERROR:', err.message);
  console.log(err.stack);
});
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE:', msg.text());
});
await page.goto('http://127.0.0.1:8000/pc.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(2000);
await browser.close();
