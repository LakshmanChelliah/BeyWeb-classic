/**
 * Browser automation / fight-capture API.
 *
 * Enabled with `?capture=1` (or `?capture=true`). Exposes `window.__beyCapture`
 * so Playwright (or a web agent) can start fights, fire specials, freeze time,
 * dump phase metadata, and screenshot the canvas.
 *
 * Also turns on ability test-no-delays so specials fire without charge/windup.
 */
import { RUNTIME_FLAGS } from '../config.js';
import { GAME_MODES } from '../game/modes.js';
import { getBeyById } from '../game/beys.js';
import { startLaunchBounce } from '../game/abilities/launchBounce.js';
import { wallClampRadius } from '../physics/arena.js';
import { CONFIG } from '../config.js';

function parseCaptureFlag() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('capture');
    if (raw == null) return false;
    const v = String(raw).trim().toLowerCase();
    return v === '' || v === '1' || v === 'true' || v === 'yes' || v === 'on';
  } catch {
    return false;
  }
}

function slotSnapshot(slot) {
  if (!slot) return null;
  return {
    id: slot.ability?.id ?? null,
    name: slot.ability?.name ?? null,
    active: Boolean(slot.active),
    activeRemaining: slot.activeRemaining ?? 0,
    windupRemaining: slot.windupRemaining ?? 0,
    windupDuration: slot.windupDuration ?? 0,
    cooldownRemaining: slot.cooldownRemaining ?? 0,
  };
}

function bodySnapshot(body) {
  if (!body) return null;
  const ud = body.userData || {};
  return {
    x: body.position.x,
    y: body.position.y,
    z: body.position.z,
    vx: body.velocity.x,
    vy: body.velocity.y,
    vz: body.velocity.z,
    beyId: ud.beyStats?.id ?? null,
    airborne: Boolean(ud.airborne),
    slamming: Boolean(ud.slamming),
    boosting: Boolean(ud.boosting),
    controlLocked: Boolean(ud.controlLocked),
    flightLift: ud.flightLift ?? 0,
    stadiumFlyOut: Boolean(ud.stadiumFlyOut),
    stadiumFlyOutT: ud.stadiumFlyOutT ?? null,
    wallRicochetT: ud.wallRicochetT ?? null,
    ringOutStyle: ud.ringOutStyle ?? null,
    bullUpperPhase: ud.bullUpperPhase ?? null,
    eagleDivePhase: ud.eagleDivePhase ?? null,
    strikerFlashPhase: ud.strikerFlashPhase ?? null,
    starBlastPhase: ud.starPhase ?? ud.starBlastPhase ?? null,
    starPhase: ud.starPhase ?? null,
    launchBouncePhase: ud.launchBounce?.phase ?? ud.launchBouncePhase ?? null,
    ldragoPhase: ud.ldragoPhase ?? null,
    ldragoFlightPhase: ud.ldragoPhase ?? ud.ldragoFlightPhase ?? null,
    ldragoLightningImpactT: ud.ldragoLightningImpactT ?? null,
    ldragoLightningHitX: ud.ldragoLightningHitX ?? null,
    ldragoLightningHitY: ud.ldragoLightningHitY ?? null,
    ldragoLightningHitZ: ud.ldragoLightningHitZ ?? null,
    ldragoApexChargeT: ud.ldragoApexChargeT ?? null,
    ldragoSoaringHit: Boolean(ud.ldragoSoaringHit),
  };
}

/**
 * @param {{ gameRef: object, selection: object, playSetup: object, campaignCtrl: object }} app
 */
export function installCaptureApi(app) {
  if (!parseCaptureFlag()) return null;

  RUNTIME_FLAGS.captureMode = true;
  RUNTIME_FLAGS.abilityTestNoDelays = true;
  RUNTIME_FLAGS.autoLaunch = true;
  document.body.classList.add('capture-mode');
  document.documentElement.dataset.capture = '1';

  const { gameRef, selection, playSetup, campaignCtrl } = app;

  function waitMs(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function waitUntil(predicate, { timeoutMs = 20000, intervalMs = 50 } = {}) {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (predicate()) return true;
      await waitMs(intervalMs);
    }
    return false;
  }

  async function waitBootReady({ timeoutMs = 25000 } = {}) {
    const ok = await waitUntil(() => document.body.classList.contains('boot-ready'), {
      timeoutMs,
    });
    if (!ok) throw new Error('Boot overlay did not finish in time');
    return true;
  }

  async function waitFightReady({ timeoutMs = 15000 } = {}) {
    const ok = await waitUntil(() => {
      const s = gameRef?.state;
      return Boolean(
        s?.gameRunning &&
          !s.gameFrozen &&
          !s.awaitingLaunch &&
          s.launchGrace <= 0 &&
          s.playerBody &&
          s.aiBody &&
          !s.pendingKo
      );
    }, { timeoutMs });
    if (!ok) throw new Error('Fight did not become ready in time');
    return true;
  }

  function snapshot() {
    const s = gameRef?.state;
    if (!s) return { ready: false };
    return {
      ready: true,
      t: performance.now(),
      gameRunning: s.gameRunning,
      gameFrozen: s.gameFrozen,
      launchGrace: s.launchGrace,
      pendingKo: Boolean(s.pendingKo),
      playerBey: s.playerBey?.id ?? null,
      aiBey: s.aiBey?.id ?? null,
      playerSpin: s.playerSpin,
      aiSpin: s.aiSpin,
      player: bodySnapshot(s.playerBody),
      ai: bodySnapshot(s.aiBody),
      abilities: {
        player: {
          power: slotSnapshot(s.abilities?.player?.power),
          special: slotSnapshot(s.abilities?.player?.special),
        },
        ai: {
          power: slotSnapshot(s.abilities?.ai?.power),
          special: slotSnapshot(s.abilities?.ai?.special),
        },
      },
    };
  }

  function placeBeys(player = {}, ai = {}) {
    const s = gameRef?.state;
    if (!s?.playerBody || !s?.aiBody) return false;
    const apply = (body, pose) => {
      if (!body || !pose) return;
      if (pose.x != null) body.position.x = pose.x;
      if (pose.y != null) body.position.y = pose.y;
      if (pose.z != null) body.position.z = pose.z;
      if (pose.vx != null) body.velocity.x = pose.vx;
      if (pose.vy != null) body.velocity.y = pose.vy;
      if (pose.vz != null) body.velocity.z = pose.vz;
      body.angularVelocity.set(0, body.angularVelocity.y, 0);
      body.wakeUp?.();
    };
    apply(s.playerBody, player);
    apply(s.aiBody, ai);
    return true;
  }

  /** Face-off near center so slam specials connect reliably. */
  function placeCloseFaceOff({ gap = 2.4, y = 0.55 } = {}) {
    const half = gap / 2;
    return placeBeys(
      { x: -half, y, z: 0, vx: 0, vy: 0, vz: 0 },
      { x: half, y, z: 0, vx: 0, vy: 0, vz: 0 }
    );
  }

  /**
   * QA helper: launch a bey toward the solid rim to verify ricochet vs fly-out.
   * `mode: 'ricochet'` keeps lift low; `mode: 'flyOut'` uses an upper-style peak.
   */
  function simulateRimLaunch({
    side = 'ai',
    mode = 'ricochet',
    source = mode === 'flyOut' ? 'bull' : 'striker',
  } = {}) {
    const s = gameRef?.state;
    const body = side === 'player' ? s?.playerBody : s?.aiBody;
    const other = side === 'player' ? s?.aiBody : s?.playerBody;
    if (!body || !other) return null;

    const maxR = wallClampRadius(body);
    const startR = Math.max(4, maxR - 3.2);
    body.position.set(startR, CONFIG.FLOOR_Y + (body.userData.outerRadius ?? 1), 0);
    body.previousPosition.x = body.position.x;
    body.previousPosition.z = body.position.z;
    body.velocity.set(0, 0, 0);

    // Park the other bey near center so they don't interfere.
    other.position.set(0, other.position.y, 0);
    other.velocity.set(0, 0, 0);

    const kbMag = mode === 'flyOut' ? 14 : 9;
    const liftScale = mode === 'flyOut' ? 1.15 : 0.35;
    body.userData.launchBounceSource = source;
    startLaunchBounce(body, 1, 0, kbMag, source, liftScale);
    if (mode === 'ricochet') {
      // Keep the victim below the rim clearance bar.
      body.userData.launchBouncePeakLift = Math.min(
        body.userData.launchBouncePeakLift ?? 4,
        CONFIG.WALL_CLEAR_LIFT * 0.55
      );
      body.userData.flightLift = 0;
    }
    return {
      mode,
      source,
      maxR,
      startR,
      peakLift: body.userData.launchBouncePeakLift ?? null,
    };
  }

  function setSpin(playerSpin, aiSpin) {
    const s = gameRef?.state;
    if (!s) return false;
    const max = 1.2;
    if (playerSpin != null) s.playerSpin = Math.max(0, Math.min(max, playerSpin));
    if (aiSpin != null) s.aiSpin = Math.max(0, Math.min(max, aiSpin));
    return true;
  }

  function freeze(on = true) {
    const s = gameRef?.state;
    if (!s) return false;
    s.gameFrozen = Boolean(on);
    return true;
  }

  function trigger(side = 'player', slot = 'special') {
    const ability = gameRef?.triggerAbility(side, slot) ?? null;
    return ability
      ? { id: ability.id, name: ability.name, glow: ability.glow ?? null }
      : null;
  }

  async function pickBey(beyId) {
    if (!selection?.focusBey?.(beyId)) {
      throw new Error(`Unknown or unplayable bey: ${beyId}`);
    }
    await waitMs(80);
    if (!selection.confirmCurrent?.()) {
      throw new Error(`Could not confirm bey: ${beyId}`);
    }
    // Selection complete hides overlay after ~600ms
    const ok = await waitUntil(
      () => document.getElementById('select-overlay')?.classList.contains('hidden'),
      { timeoutMs: 8000 }
    );
    if (!ok) throw new Error('Select overlay did not hide after pick');
    return true;
  }

  async function setCasualMode() {
    playSetup?.setMode?.(GAME_MODES.CASUAL);
    playSetup?.setDifficulty?.(0);
    await waitMs(50);
    return playSetup?.getState?.() ?? null;
  }

  async function startMatch() {
    const btn = document.getElementById('btn-start');
    if (!btn || btn.disabled) {
      // Overlay may already be ready — try direct start
      if (gameRef?.startGame && !gameRef.state.gameRunning) {
        await gameRef.startGame();
      }
    } else {
      btn.click();
    }
    await waitFightReady();
    return snapshot();
  }

  /**
   * Full path: boot → Casual → pick player bey → Start → wait launch grace.
   * CPU rival is random unless `forceAiBeyId` is set after start.
   */
  async function bootCasualFight({
    playerBeyId = 'pegasus',
    forceAiBeyId = null,
    difficulty = 0,
  } = {}) {
    await waitBootReady();
    await setCasualMode();
    if (difficulty != null) playSetup?.setDifficulty?.(difficulty);
    await waitMs(80);
    await pickBey(playerBeyId);
    await waitUntil(() => {
      const btn = document.getElementById('btn-start');
      return btn && !btn.disabled && !document.getElementById('start-overlay')?.classList.contains('hidden');
    }, { timeoutMs: 8000 });
    await startMatch();

    if (forceAiBeyId) {
      const bey = getBeyById(forceAiBeyId);
      if (!bey) throw new Error(`Unknown forceAiBeyId: ${forceAiBeyId}`);
      // Soft override for VFX QA — models may already be loaded for random rival.
      gameRef.state.aiBey = bey;
      campaignCtrl?.updateHud?.();
    }

    setSpin(1, 1);
    placeCloseFaceOff();
    return snapshot();
  }

  const api = {
    version: 1,
    enabled: true,
    waitMs,
    waitUntil,
    waitBootReady,
    waitFightReady,
    snapshot,
    placeBeys,
    placeCloseFaceOff,
    simulateRimLaunch,
    setSpin,
    freeze,
    trigger,
    pickBey,
    setCasualMode,
    startMatch,
    bootCasualFight,
    getGameRef: () => gameRef,
    getSelection: () => selection,
    getPlaySetup: () => playSetup,
  };

  window.__beyCapture = api;
  console.info('[bey-capture] window.__beyCapture ready');
  return api;
}
