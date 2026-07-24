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
const SAMPLE_MS = 1200;
// Wall radius — tunneling means the center clears the rim on a solid arc.
const WALL_RADIUS = 13.55;
// Brief clamp-ease overshoot (~MAX_CLASH_SEPARATION) is OK; escaping the rim is not.
const ESCAPE_R = WALL_RADIUS;
// Solid arcs beside the left-far (240° ± 24° → 216–264) pocket + mid-arc control.
// Stay ≥6° clear of pocket mouths so ring-out gaps are not mistaken for tunnels.
const ANGLES_DEG = [60, 200, 210, 270, 280];

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
const peaks = [];

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
  let maxDist = 0;
  let endDist = 0;
  let ringOut = false;
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
      return {
        dist: Math.hypot(x, z),
        ringOut: Boolean(body.userData.ringOut),
        angle: Math.atan2(z, x),
      };
    });
    if (sample) {
      maxDist = Math.max(maxDist, sample.dist);
      endDist = sample.dist;
      ringOut = ringOut || sample.ringOut;
      if (sample.dist > ESCAPE_R || sample.ringOut) {
        leaks.push({
          deg,
          dist: Number(sample.dist.toFixed(3)),
          maxDist: Number(maxDist.toFixed(3)),
          ringOut: sample.ringOut,
          angleDeg: Number(((sample.angle * 180) / Math.PI).toFixed(1)),
        });
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 16));
  }

  peaks.push({
    deg,
    maxDist: Number(maxDist.toFixed(3)),
    endDist: Number(endDist.toFixed(3)),
    ringOut,
  });
}

// Clash knockback against a left-far solid arc (210°) — original tunnel vector.
{
  const deg = 210;
  const ang = (deg * Math.PI) / 180;
  await page.evaluate(({ ang }) => {
    const g = window.__beyCapture.getGameRef();
    const st = g.state;
    const body = st.playerBody;
    const ai = st.aiBody;
    const R = 11.8;
    const nx = Math.cos(ang);
    const nz = Math.sin(ang);
    const tx = -nz;
    const tz = nx;
    for (const b of [body, ai]) {
      b.userData.ringOut = false;
      b.userData.collisionsDisabled = false;
      b.userData.launching = false;
      b.userData.airborne = false;
    }
    body.position.set(nx * R, body.position.y, nz * R);
    ai.position.set(nx * (R - 1.6), ai.position.y, nz * (R - 1.6));
    body.previousPosition.copy(body.position);
    ai.previousPosition.copy(ai.position);
    body.velocity.set(nx * 12 + tx * 6, 0, nz * 12 + tz * 6);
    ai.velocity.set(-nx * 14 + tx * 4, 0, -nz * 14 + tz * 4);
    st.pendingKo = null;
    st.playerSpin = 1;
    st.aiSpin = 1;
    st.launchGrace = 0;
  }, { ang });

  const start = Date.now();
  let maxDist = 0;
  let endDist = 0;
  let ringOut = false;
  while (Date.now() - start < SAMPLE_MS) {
    const sample = await page.evaluate(() => {
      const st = window.__beyCapture.getGameRef().state;
      st.pendingKo = null;
      st.playerSpin = Math.max(st.playerSpin, 0.85);
      st.aiSpin = Math.max(st.aiSpin, 0.85);
      let maxD = 0;
      let anyRing = false;
      for (const b of [st.playerBody, st.aiBody]) {
        maxD = Math.max(maxD, Math.hypot(b.position.x, b.position.z));
        anyRing = anyRing || Boolean(b.userData.ringOut);
      }
      return { dist: maxD, ringOut: anyRing };
    });
    if (sample) {
      maxDist = Math.max(maxDist, sample.dist);
      endDist = sample.dist;
      ringOut = ringOut || sample.ringOut;
      if (sample.dist > ESCAPE_R || sample.ringOut) {
        leaks.push({
          deg: `${deg}-clash`,
          dist: Number(sample.dist.toFixed(3)),
          maxDist: Number(maxDist.toFixed(3)),
          ringOut: sample.ringOut,
        });
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 16));
  }
  peaks.push({
    deg: `${deg}-clash`,
    maxDist: Number(maxDist.toFixed(3)),
    endDist: Number(endDist.toFixed(3)),
    ringOut,
  });
}

const report = {
  url: URL,
  anglesDeg: ANGLES_DEG,
  escapeR: ESCAPE_R,
  leakCount: leaks.length,
  leaks: leaks.slice(0, 12),
  peaks,
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
