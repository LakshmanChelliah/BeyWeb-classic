import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:8000';
const errors = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`${BASE}/pc.html`, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForTimeout(1500);

const metrics = await page.evaluate(async () => {
  const THREE = await import('three');
  const { preloadTopModel } = await import('./js/render/modelCache.js');
  const { getBeyById } = await import('./js/game/beys.js');

  async function measure(bey) {
    const holder = await preloadTopModel(bey.model);
    const box = new THREE.Box3().setFromObject(holder);
    const size = box.getSize(new THREE.Vector3());
    return {
      id: bey.id,
      size: [size.x, size.y, size.z].map((v) => +v.toFixed(3)),
      outerR: +(Math.max(size.x, size.z) * 0.5).toFixed(3),
      rotX: +holder.rotation.x.toFixed(3),
    };
  }

  return {
    meteo: await measure(getBeyById('meteo_ldrago')),
    lightning: await measure(getBeyById('lightning_ldrago')),
    pegasus: await measure(getBeyById('pegasus')),
  };
});

console.log(JSON.stringify(metrics, null, 2));

const ok =
  metrics.meteo.rotX === 0 &&
  metrics.meteo.size[1] >= 0.95 &&
  metrics.lightning.rotX > 1;

if (!ok) {
  console.error('FAIL: Meteo should spin on Y (rotX=0); Lightning keeps pole fix');
  process.exitCode = 1;
} else if (errors.length) {
  console.error('ERRORS:', errors);
  process.exitCode = 1;
} else {
  console.log('OK: Meteo orientation restored; Lightning pole rotation preserved');
}

await browser.close();
