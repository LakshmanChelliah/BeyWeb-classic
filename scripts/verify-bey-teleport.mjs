#!/usr/bin/env node
/**
 * Boots a Casual fight and watches for unnatural XZ position jumps that look
 * like teleports (rim clamp / clash separation glitches).
 *
 * Usage: node scripts/verify-bey-teleport.mjs
 * Requires: playwright + chromium, `npm run dev` on :8000
 */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:8000/pc.html?capture=1';
const SAMPLE_MS = 5000;
// PC can catch up to 5 physics steps per frame; 26 u/s * 5/60 ≈ 2.17.
const JUMP_THRESH = 2.4;

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
  // Mid solid-wall arc (π/3) — not a KO pocket — so clamp/clash stress sticks.
  const g = api.getGameRef();
  const ang = Math.PI / 3;
  const R = 11.8;
  const nx = Math.cos(ang);
  const nz = Math.sin(ang);
  const tx = -nz;
  const tz = nx;
  g.state.playerBody.position.set(nx * R, g.state.playerBody.position.y, nz * R);
  g.state.aiBody.position.set(nx * (R - 1.7), g.state.aiBody.position.y, nz * (R - 1.7));
  g.state.playerBody.velocity.set(nx * 10 + tx * 4, 0, nz * 10 + tz * 4);
  g.state.aiBody.velocity.set(-nx * 6 + tx * 8, 0, -nz * 6 + tz * 8);
  g.state.playerBody.previousPosition.copy(g.state.playerBody.position);
  g.state.aiBody.previousPosition.copy(g.state.aiBody.position);
  // Keep the match alive for the probe window.
  g.state.pendingKo = null;
  g.state.playerSpin = 1;
  g.state.aiSpin = 1;
});

// Poll from Node so headless rAF throttling cannot starve the sample window.
const start = Date.now();
let frames = 0;
const jumps = [];
let maxJump = 0;
let lastSnap = null;

while (Date.now() - start < SAMPLE_MS) {
  const sample = await page.evaluate(({ jumpThresh, frame }) => {
    const api = window.__beyCapture;
    const g = api.getGameRef();
    const st = g?.state;
    if (!st?.playerBody || !st?.aiBody) return null;

    st.pendingKo = null;
    st.playerSpin = Math.max(st.playerSpin, 0.85);
    st.aiSpin = Math.max(st.aiSpin, 0.85);
    // If a bey escapes the solid arc, teleport it back for continued stress.
    const ang = Math.PI / 3;
    for (const body of [st.playerBody, st.aiBody]) {
      const r = Math.hypot(body.position.x, body.position.z);
      if (body.userData.ringOut || r > 13.2) {
        body.userData.ringOut = false;
        body.position.x = Math.cos(ang) * 11.5;
        body.position.z = Math.sin(ang) * 11.5;
        body.previousPosition.copy(body.position);
        body.velocity.set(Math.cos(ang) * 8, 0, Math.sin(ang) * 8);
        body.userData._teleportProbePrev = null;
      }
    }

    const found = [];
    for (const [label, body] of [
      ['player', st.playerBody],
      ['ai', st.aiBody],
    ]) {
      const prev = body.userData._teleportProbePrev;
      const x = body.position.x;
      const z = body.position.z;
      if (prev) {
        const dist = Math.hypot(x - prev.x, z - prev.z);
        const cinematic =
          body.type === 4 ||
          body.userData.airborne ||
          body.userData.collisionsDisabled ||
          body.userData.strikerFlashPhase ||
          body.userData.starPhase ||
          body.userData.ldragoPhase;
        if (dist > jumpThresh && !cinematic) {
          found.push({
            label,
            dist: Number(dist.toFixed(3)),
            x: Number(x.toFixed(3)),
            z: Number(z.toFixed(3)),
            r: Number(Math.hypot(x, z).toFixed(3)),
            speed: Number(Math.hypot(body.velocity.x, body.velocity.z).toFixed(3)),
          });
        }
        body.userData._teleportProbeMaxJump = Math.max(
          body.userData._teleportProbeMaxJump ?? 0,
          dist
        );
      }
      body.userData._teleportProbePrev = { x, z };
    }

    if (frame % 8 === 0) {
      const ang = Math.PI / 3;
      st.playerBody.velocity.x += Math.cos(ang) * 2;
      st.playerBody.velocity.z += Math.sin(ang) * 2;
      st.aiBody.velocity.x -= Math.cos(ang) * 1.5;
      st.aiBody.velocity.z -= Math.sin(ang) * 1.5;
    }

    const body = st.playerBody;
    return {
      found,
      maxJump: Math.max(
        body.userData._teleportProbeMaxJump ?? 0,
        st.aiBody.userData._teleportProbeMaxJump ?? 0
      ),
      playerR: Math.hypot(body.position.x, body.position.z),
      aiR: Math.hypot(st.aiBody.position.x, st.aiBody.position.z),
      colliderR: body.userData.outerRadius,
      visualR: body.userData.visualOuterRadius,
    };
  }, { jumpThresh: JUMP_THRESH, frame: frames });

  frames++;
  if (sample) {
    lastSnap = sample;
    maxJump = Math.max(maxJump, sample.maxJump);
    for (const j of sample.found) jumps.push({ ...j, t: Date.now() - start });
  }
  await new Promise((r) => setTimeout(r, 16));
}

const clampRPlayer = lastSnap
  ? 13.55 - 0.32 - lastSnap.colliderR - 0.02
  : null;

const report = {
  frames,
  jumps: jumps.slice(0, 12),
  jumpCount: jumps.length,
  maxJump: Number(maxJump.toFixed(3)),
  playerR: lastSnap ? Number(lastSnap.playerR.toFixed(3)) : null,
  aiR: lastSnap ? Number(lastSnap.aiR.toFixed(3)) : null,
  clampRPlayer: clampRPlayer != null ? Number(clampRPlayer.toFixed(3)) : null,
  colliderR: lastSnap ? Number(lastSnap.colliderR.toFixed(3)) : null,
  visualR: lastSnap ? Number(lastSnap.visualR.toFixed(3)) : null,
};

console.log(JSON.stringify({ url: URL, ...report, pageErrors: errors }, null, 2));

const fail = report.jumpCount > 0 || errors.length > 0;
if (fail) {
  console.error('FAIL: unnatural jumps or page errors detected');
  process.exitCode = 1;
} else {
  console.log('OK: no dynamic teleport jumps above', JUMP_THRESH);
}

await browser.close();
