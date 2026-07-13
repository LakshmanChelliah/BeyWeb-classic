#!/usr/bin/env node
/**
 * Smoke-test stadium rim ricochet vs over-wall fly-out via capture API.
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PORT = 8765;
const URL = `http://127.0.0.1:${PORT}/pc.html?capture=1`;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitServer(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 200) return;
    } catch {
      // retry
    }
    await sleep(200);
  }
  throw new Error('Server did not start');
}

async function runCase(page, mode) {
  await page.evaluate(async (m) => {
    await window.__beyCapture.bootCasualFight({ playerBeyId: 'bull' });
    window.__beyCapture.setSpin(1, 1);
    window.__beyCapture.simulateRimLaunch({ side: 'ai', mode: m });
  }, mode);

  const samples = [];
  for (let i = 0; i < 45; i++) {
    await sleep(50);
    const snap = await page.evaluate(() => window.__beyCapture.snapshot());
    const ai = snap.ai || {};
    samples.push({
      t: i,
      dist: Math.hypot(ai.x ?? 0, ai.z ?? 0),
      lift: ai.flightLift ?? 0,
      flyOut: !!ai.stadiumFlyOut,
      ricochet: ai.wallRicochetT != null,
      phase: ai.launchBouncePhase,
      pendingKo: snap.pendingKo,
    });
  }
  return samples;
}

function summarize(mode, samples) {
  const maxDist = Math.max(...samples.map((s) => s.dist));
  const sawFlyOut = samples.some((s) => s.flyOut);
  const sawRicochet = samples.some((s) => s.ricochet);
  const final = samples[samples.length - 1];
  return { mode, maxDist, sawFlyOut, sawRicochet, final };
}

async function main() {
  const server = spawn(
    'npx',
    ['--yes', 'http-server', '-p', String(PORT), '-c-1', '-a', '127.0.0.1', '.'],
    { cwd: ROOT, stdio: 'ignore' }
  );

  try {
    await waitServer(`http://127.0.0.1:${PORT}/pc.html`);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    page.on('pageerror', (err) => console.error('PAGEERROR', err.message));
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForFunction(() => window.__beyCapture?.enabled, { timeout: 30000 });

    const ricochet = summarize('ricochet', await runCase(page, 'ricochet'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__beyCapture?.enabled, { timeout: 30000 });
    const flyOut = summarize('flyOut', await runCase(page, 'flyOut'));

    console.log(JSON.stringify({ ricochet, flyOut }, null, 2));

    const ricochetOk = !ricochet.sawFlyOut && ricochet.maxDist < 14.5;
    const flyOutOk = flyOut.sawFlyOut && flyOut.maxDist > 13.0;
    if (!ricochetOk || !flyOutOk) {
      console.error('FAIL', { ricochetOk, flyOutOk });
      process.exitCode = 1;
    } else {
      console.log('PASS stadium wall ricochet + fly-out');
    }

    await browser.close();
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
