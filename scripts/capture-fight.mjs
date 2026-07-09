#!/usr/bin/env node
/**
 * Fight-capture recorder — Playwright drives pc.html?capture=1, fires specials,
 * and dumps canvas frames + phase JSON for VFX QA.
 *
 * Usage:
 *   node scripts/capture-fight.mjs
 *   node scripts/capture-fight.mjs --url http://127.0.0.1:8765/pc.html --out /tmp/bey-frames
 *   node scripts/capture-fight.mjs --bey pegasus --slot special --seconds 2.5
 *   node scripts/capture-fight.mjs --suite   # all playable specials
 *
 * Requires: playwright + chromium (`npx playwright install chromium`)
 * Server:   npm run dev   (or any static host of the repo root)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const PLAYABLE_SPECIALS = [
  { bey: 'pegasus', label: 'star-blast' },
  { bey: 'lightning_ldrago', label: 'soaring-destruction' },
  { bey: 'meteo_ldrago', label: 'absorb-break' },
  { bey: 'leone', label: 'lion-wall' },
  { bey: 'libra', label: 'sonic-buster' },
  { bey: 'eagle', label: 'diving-crush' },
  { bey: 'striker', label: 'lightning-flash' },
  { bey: 'bull', label: 'red-horn-uppercut' },
];

function parseArgs(argv) {
  const out = {
    url: process.env.BEY_CAPTURE_URL || 'http://127.0.0.1:8000/pc.html',
    outDir: process.env.BEY_CAPTURE_OUT || path.join('/opt/cursor/artifacts', 'bey-fight-frames'),
    bey: 'pegasus',
    slot: 'special',
    side: 'player',
    seconds: 2.8,
    fps: 12,
    headed: false,
    suite: false,
    power: false,
    width: 1280,
    height: 720,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    if (a === '--url') out.url = next();
    else if (a === '--out') out.outDir = next();
    else if (a === '--bey') out.bey = next();
    else if (a === '--slot') out.slot = next();
    else if (a === '--side') out.side = next();
    else if (a === '--seconds') out.seconds = Number(next());
    else if (a === '--fps') out.fps = Number(next());
    else if (a === '--width') out.width = Number(next());
    else if (a === '--height') out.height = Number(next());
    else if (a === '--headed') out.headed = true;
    else if (a === '--suite') out.suite = true;
    else if (a === '--power') {
      out.power = true;
      out.slot = 'power';
    }
  }
  return out;
}

function ensureCaptureUrl(url) {
  const u = new URL(url);
  if (!u.searchParams.has('capture')) u.searchParams.set('capture', '1');
  return u.toString();
}

function pad(n, w = 4) {
  return String(n).padStart(w, '0');
}

async function dumpFrame(page, dir, index, meta) {
  const canvas = page.locator('#game-canvas');
  const pngPath = path.join(dir, `frame_${pad(index)}.png`);
  const jsonPath = path.join(dir, `frame_${pad(index)}.json`);
  await canvas.screenshot({ path: pngPath, type: 'png' });
  fs.writeFileSync(jsonPath, JSON.stringify(meta, null, 2));
  return pngPath;
}

async function captureClip(page, {
  outDir,
  bey,
  label,
  slot,
  side,
  seconds,
  fps,
}) {
  const clipDir = path.join(outDir, `${bey}-${label || slot}`);
  fs.mkdirSync(clipDir, { recursive: true });

  const snap0 = await page.evaluate(async ({ beyId }) => {
    const api = window.__beyCapture;
    if (!api) throw new Error('__beyCapture missing — open with ?capture=1');
    return api.bootCasualFight({ playerBeyId: beyId, difficulty: 0 });
  }, { beyId: bey });

  // Settle one frame after placement
  await page.waitForTimeout(120);
  await page.evaluate(() => {
    const api = window.__beyCapture;
    api.setSpin(1, 1);
    api.placeCloseFaceOff();
  });

  const fired = await page.evaluate(({ sideName, slotName }) => {
    const api = window.__beyCapture;
    const ability = api.trigger(sideName, slotName);
    return {
      fired: Boolean(ability),
      abilityId: ability?.id ?? null,
      abilityName: ability?.name ?? null,
      snapshot: api.snapshot(),
    };
  }, { sideName: side, slotName: slot });

  const intervalMs = Math.max(16, Math.round(1000 / fps));
  const totalFrames = Math.max(1, Math.round((seconds * 1000) / intervalMs));
  const frames = [];

  for (let i = 0; i < totalFrames; i++) {
    const meta = await page.evaluate((frameIndex) => {
      const snap = window.__beyCapture.snapshot();
      return { frameIndex, ...snap };
    }, i);
    const png = await dumpFrame(page, clipDir, i, meta);
    frames.push({ index: i, png: path.basename(png), t: meta.t });
    if (i < totalFrames - 1) await page.waitForTimeout(intervalMs);
  }

  // Mid-clip freeze sample for still review
  await page.evaluate(() => window.__beyCapture.freeze(true));
  const freezeMeta = await page.evaluate(() => ({
    frozen: true,
    ...window.__beyCapture.snapshot(),
  }));
  await dumpFrame(page, clipDir, totalFrames, freezeMeta);
  await page.evaluate(() => window.__beyCapture.freeze(false));

  const manifest = {
    bey,
    label: label || slot,
    slot,
    side,
    seconds,
    fps,
    fired,
    boot: snap0,
    frames: frames.length + 1,
    dir: clipDir,
    createdAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(clipDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`OK ${bey}/${slot}: ${frames.length + 1} frames → ${clipDir}`);
  return manifest;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = ensureCaptureUrl(args.url);
  fs.mkdirSync(args.outDir, { recursive: true });

  console.log('Capture URL:', url);
  console.log('Out dir:', args.outDir);

  const browser = await chromium.launch({
    headless: !args.headed,
    args: ['--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  const page = await browser.newPage({
    viewport: { width: args.width, height: args.height },
    deviceScaleFactor: 1,
  });

  const errors = [];
  page.on('pageerror', (err) => errors.push(`PAGE: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`CONSOLE: ${msg.text()}`);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => Boolean(window.__beyCapture), null, { timeout: 30000 });
  await page.waitForFunction(() => document.body.classList.contains('boot-ready'), null, {
    timeout: 30000,
  });

  const jobs = args.suite
    ? PLAYABLE_SPECIALS.map((j) => ({
        bey: j.bey,
        label: j.label,
        slot: args.power ? 'power' : 'special',
        side: args.side,
        seconds: args.seconds,
        fps: args.fps,
      }))
    : [
        {
          bey: args.bey,
          label: args.bey,
          slot: args.slot,
          side: args.side,
          seconds: args.seconds,
          fps: args.fps,
        },
      ];

  const results = [];
  for (const job of jobs) {
    // Fresh navigation per clip so selection/state is clean
    if (results.length > 0) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForFunction(() => Boolean(window.__beyCapture), null, { timeout: 30000 });
      await page.waitForFunction(() => document.body.classList.contains('boot-ready'), null, {
        timeout: 30000,
      });
    }
    try {
      results.push(await captureClip(page, { outDir: args.outDir, ...job }));
    } catch (err) {
      console.error(`FAIL ${job.bey}/${job.slot}:`, err.message || err);
      results.push({ bey: job.bey, slot: job.slot, error: String(err.message || err) });
    }
  }

  const summary = {
    url,
    outDir: args.outDir,
    results,
    errors: errors.slice(0, 40),
    createdAt: new Date().toISOString(),
  };
  const summaryPath = path.join(args.outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log('Summary:', summaryPath);
  if (errors.length) {
    console.log('Page errors:', errors.length);
    errors.slice(0, 10).forEach((e) => console.log(' ', e));
  }

  await browser.close();

  const failed = results.filter((r) => r.error);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
