#!/usr/bin/env node
/**
 * Capture one still of each arena skin for visual review.
 * Usage: node scripts/capture-stadiums.mjs [--url http://127.0.0.1:8000/pc.html]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const STADIUMS = [
  { id: 'bull_forge', name: 'Abandoned Construction Site', bey: 'bull' },
  { id: 'libra_balance', name: 'Survival Island', bey: 'libra' },
  { id: 'eagle_aerie', name: 'WBBA Headquarters', bey: 'eagle' },
  { id: 'leone_bastion', name: 'Metal Bey Rooftop', bey: 'leone' },
  { id: 'storm_circuit', name: 'Koma Village', bey: 'pegasus' },
  { id: 'dragons_maw', name: 'Dark Nebula HQ Rooftop', bey: 'lightning_ldrago' },
  { id: 'striker_rink', name: 'City Streets', bey: 'striker' },
  { id: 'meteo_crucible', name: 'Volcano Interior', bey: 'meteo_ldrago' },
];

function parseArgs(argv) {
  const out = {
    url: process.env.BEY_CAPTURE_URL || 'http://127.0.0.1:8000/pc.html',
    outDir: process.env.BEY_STADIUM_OUT || '/opt/cursor/artifacts/stadium-screenshots',
    width: 1440,
    height: 900,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--url') out.url = argv[++i];
    else if (a === '--out') out.outDir = argv[++i];
  }
  return out;
}

const opts = parseArgs(process.argv.slice(2));
fs.mkdirSync(opts.outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: opts.width, height: opts.height },
  deviceScaleFactor: 1,
});

const errors = [];
page.on('pageerror', (err) => errors.push(err.message));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});

const results = [];

for (const stadium of STADIUMS) {
  const u = new URL(opts.url);
  u.searchParams.set('capture', '1');
  u.searchParams.set('arena', stadium.id);
  console.log(`\n=== ${stadium.id} (${stadium.name}) ===`);
  console.log(u.toString());

  await page.goto(u.toString(), { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForFunction(() => window.__beyCapture?.enabled, { timeout: 30000 });

  const meta = await page.evaluate(async ({ bey, arenaId }) => {
    const api = window.__beyCapture;
    await api.waitBootReady();
    const game = api.getGameRef?.();
    game?.setArenaSkin?.(arenaId, { persist: false });
    await api.bootCasualFight({ playerBeyId: bey, forceAiBeyId: 'pegasus' });
    api.freeze(true);

    // Fight-like venue view (matches in-game framing better than a top-down).
    const cam = game?.camera;
    const indoor = arenaId === 'eagle_aerie';
    if (cam) {
      cam.position.set(0, indoor ? 20 : 28, indoor ? 22 : 30);
      cam.lookAt(0, indoor ? 2 : 0, 0);
      cam.updateProjectionMatrix?.();
    }
    // Don't blow out venue fog — outdoor captures can open slightly.
    if (game?.scene?.fog && !indoor) {
      game.scene.fog.near = Math.max(game.scene.fog.near ?? 40, 70);
      game.scene.fog.far = Math.max(game.scene.fog.far ?? 120, 180);
    }

    const hideIds = [
      'start-overlay',
      'select-overlay',
      'hud',
      'faceoff-overlay',
      'arena-transition',
      'result-overlay',
      'controls-hint',
      'p1-abilities',
      'p2-abilities',
      'player-abilities',
      'special-flash',
    ];
    for (const id of hideIds) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('hidden');
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('opacity', '0', 'important');
      }
    }
    document.querySelectorAll('.ability-bar').forEach((el) => {
      el.classList.remove('visible');
      el.style.setProperty('display', 'none', 'important');
    });

    // Force one render with frozen sim
    game?.renderer?.render?.(game.scene, game.camera);
    await api.waitMs(300);
    game?.renderer?.render?.(game.scene, game.camera);

    return { skinId: game?.getArenaSkinId?.() ?? null };
  }, { bey: stadium.bey, arenaId: stadium.id });

  await page.waitForTimeout(200);

  const file = path.join(opts.outDir, `${stadium.id}.png`);
  await page.locator('#game-canvas').screenshot({ path: file, type: 'png' });
  const stat = fs.statSync(file);
  console.log(`saved ${file} (${stat.size} bytes) skin=${meta.skinId}`);
  results.push({
    id: stadium.id,
    name: stadium.name,
    file,
    bytes: stat.size,
    skinId: meta.skinId,
  });
}

fs.writeFileSync(
  path.join(opts.outDir, 'manifest.json'),
  JSON.stringify({ capturedAt: new Date().toISOString(), results, errors }, null, 2)
);

console.log('\nDone. Manifest:', path.join(opts.outDir, 'manifest.json'));
if (errors.length) {
  console.log('Page errors during capture:');
  for (const e of errors.slice(0, 20)) console.log(' ', e);
}

await browser.close();
