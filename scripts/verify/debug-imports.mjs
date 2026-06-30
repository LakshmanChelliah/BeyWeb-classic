import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const loaded = [];
page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('.js')) return;
  const status = res.status();
  if (status >= 400) {
    console.log('HTTP', status, url);
    return;
  }
  try {
    const text = await res.text();
    // Quick parse check
    new Function(text); // won't work for modules
    loaded.push(url);
  } catch (_) {}
});
page.on('pageerror', (err) => console.log('PAGE:', err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('CONSOLE:', msg.text());
});

await page.goto('http://127.0.0.1:8000/pc.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);

// Parse each game js file individually in browser
const files = await page.evaluate(async () => {
  const scripts = [
    '/js/config.js',
    '/js/game/abilities/constants.js',
    '/js/game/abilities/shared.js',
    '/js/game/abilities/registry/pegasus.js',
    '/js/game/abilities/registry/ldrago.js',
    '/js/game/abilities/registry/leone.js',
    '/js/game/abilities/registry/libra.js',
    '/js/game/abilities/registry/bull.js',
    '/js/game/abilities/registry/eagle.js',
    '/js/game/abilities/registry/striker.js',
    '/js/game/abilities/registry/index.js',
    '/js/game/abilities/runtime.js',
    '/js/game/abilities/contact.js',
    '/js/game/abilities/timers.js',
    '/js/game/abilities/presentation.js',
    '/js/game/abilities/visuals/pegasus.js',
    '/js/game/abilities/index.js',
    '/js/game/engine.js',
    '/js/app/bootstrap.js',
    '/js/main-pc.js',
  ];
  const results = [];
  for (const url of scripts) {
    try {
      await import(url);
      results.push({ url, ok: true });
    } catch (e) {
      results.push({ url, ok: false, error: e.message });
    }
  }
  return results;
});

for (const r of files) {
  if (!r.ok) console.log('IMPORT FAIL:', r.url, '-', r.error);
  else console.log('OK:', r.url);
}

await browser.close();
