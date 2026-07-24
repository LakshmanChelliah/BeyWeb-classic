#!/usr/bin/env node
/**
 * Boots a Casual fight and fires a bey into solid rim arcs (not KO pockets).
 * Fails if the center escapes past wallClampRadius or ringOut triggers on a
 * solid-wall angle — regression for sparse-segment tunneling.
 *
 * Usage: node scripts/verify-solid-wall-containment.mjs
 * Requires: playwright + chromium, `npm run dev` on :8000
 */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:8000/pc.html?capture=1';
const SAMPLE_MS = 900;
const OVERSHOOT_EPS = 0.35;
// Solid arcs beside the left-far (240°) pocket + mid-arc control (π/3).
const ANGLES_DEG = [60, 200, 220, 260, 280];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(err.message));

await page.goto(URL, { waitUntil: 'networkidle', timeout: 45000 });
await page.waitForFunction(() => Boolean(window.__beyCapture), null, { timeout: 30000 });

await page.evaluate(async () => {
  const api = window.__beyCapture;
  await api.bootCasualFight({ playerBeyId: 'pegasus', difficulty: 0 });
  api.setSpin(1, 1);
});

const leaks = [];

for (const deg of ANGLES_DEG) {
  const ang = (deg * Math.PI) / 180;
  await page.evaluate(({ ang }) => {
    const api = window.__beyCapture;
    const g = api.getGameRef();
    const st = g.state;
    const body = st.playerBody;
    const ai = st.aiBody;
    const R = 11.6;
    const nx = Math.cos(ang);
    const nz = Math.sin(ang);
    body.userData.ringOut = false;
    body.userData.collisionsDisabled = false;
    body.userData.launching = false;
    body.userData.airborne = false;
    body.position.set(nx * R, body.position.y, nz * R);
    body.previousPosition.copy(body.position);
    body.velocity.set(nx * 28, 0, nz * 28);
    body.angularVelocity.set(0, 40, 0);
    // Park AI out of the way so clash separation cannot eject into a pocket.
    ai.userData.ringOut = false;
    ai.position.set(-nx * 4, ai.position.y, -nz * 4);
    ai.previousPosition.copy(ai.position);
    ai.velocity.set(0, 0, 0);
    st.pendingKo = null;
    st.playerSpin = 1;
    st.aiSpin = 1;
    st.launchGrace = 0;
  }, { ang });

  const start = Date.now();
  let worst = null;
  while (Date.now() - start < SAMPLE_MS) {
    const sample = await page.evaluate(() => {
      const api = window.__beyCapture;
      const g = api.getGameRef();
      const st = g?.state;
      const body = st?.playerBody;
      if (!body) return null;
      st.pendingKo = null;
      st.playerSpin = Math.max(st.playerSpin, 0.85);
      const x = body.position.x;
      const z = body.position.z;
      const dist = Math.hypot(x, z);
      const colliderR = body.userData.outerRadius ?? 1.05;
      const maxR = 13.55 - 0.32 - colliderR - 0.02;
      const angle = Math.atan2(z, x);
      return {
        dist,
        maxR,
        overshoot: dist - maxR,
        angle,
        ringOut: Boolean(body.userData.ringOut),
        x,
        z,
      };
    });
    if (sample) {
      if (!worst || sample.overshoot > worst.overshoot) worst = sample;
      if (sample.overshoot > OVERSHOOT_EPS || sample.ringOut) {
        leaks.push({
          deg,
          overshoot: Number(sample.overshoot.toFixed(3)),
          dist: Number(sample.dist.toFixed(3)),
          maxR: Number(sample.maxR.toFixed(3)),
          ringOut: sample.ringOut,
          angleDeg: Number(((sample.angle * 180) / Math.PI).toFixed(1)),
        });
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 16));
  }

  if (!leaks.some((l) => l.deg === deg) && worst) {
    // Record peak overshoot for the report even on pass.
    worst._deg = deg;
  }
}

const report = {
  url: URL,
  anglesDeg: ANGLES_DEG,
  overshootEps: OVERSHOOT_EPS,
  leakCount: leaks.length,
  leaks: leaks.slice(0, 12),
  pageErrors: errors,
};

console.log(JSON.stringify(report, null, 2));

const fail = report.leakCount > 0 || errors.length > 0;
if (fail) {
  console.error('FAIL: bey escaped solid wall arc or page errors');
  process.exitCode = 1;
} else {
  console.log('OK: solid-wall containment held for', ANGLES_DEG.join(', '), 'deg');
}

await browser.close();
