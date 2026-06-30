import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { clamp01 } from '../../../utils/math.js';
import * as shared from '../shared.js';
import * as C from '../constants.js';

export function tickEagleAbilityVisuals(state, dt) {
  if (!state.abilities) return;
  for (const side of ['player', 'ai']) {
    const body = side === 'player' ? state.playerBody : state.aiBody;
    const opp = side === 'player' ? state.aiBody : state.playerBody;
    if (!body) continue;
    const runtime = state.abilities[side];
    if (!runtime) continue;

    const pwSlot = runtime.power;
    if (pwSlot?.active && pwSlot.ability.id === 'eagle_counter_stance') {
      const t = body.userData.eagleCounterT ?? 0;
      body.userData.eagleCounterT = t + dt;
      const pulse = 0.5 + 0.5 * Math.sin(t * 18);
      body.userData.flightSquash = 0.93 + pulse * 0.03;
      body.userData.flightTilt = Math.sin(t * 10) * 0.035;
      body.userData.flightRoll = Math.cos(t * 8) * 0.025;
      if ((body.userData.eagleCounterFlashT ?? 0) > 0) {
        body.userData.eagleCounterFlashT = Math.max(0, body.userData.eagleCounterFlashT - dt * 3.2);
      }
    }

    const spSlot = runtime.special;
    if (!spSlot || spSlot.ability.id !== 'eagle_diving_crush') continue;
    const inMove = spSlot.windupRemaining > 0 || spSlot.active || body.userData.eagleDivePhase != null;
    if (!inMove) continue;

    body.position.y = C.groundY(body);
    body.velocity.set(0, 0, 0);

    if (spSlot.windupRemaining > 0) {
      const windup = C.slotWindupTotal(spSlot, 0.55);
      const t = clamp01(windup > 0 ? 1 - spSlot.windupRemaining / windup : 1);
      body.userData.eagleDiveWindup = true;
      body.userData.flightLift = 0;
      body.userData.flightTilt = 0.16 * C.easeOutQuad(t);
      body.userData.flightRoll = Math.sin(t * Math.PI * 3) * 0.08;
      body.userData.flightSquash = 1 - 0.18 * C.easeOutQuad(t);
      body.userData.slamming = false;
      body.userData.eagleDiveSlamming = false;
      setBodyCollisions(body, false);
      continue;
    }

    if (!spSlot.active) continue;
    body.userData.eagleDiveWindup = false;
    const phase = body.userData.eagleDivePhase ?? 'ascend';
    body.userData.eagleDivePhaseT = (body.userData.eagleDivePhaseT ?? 0) + dt;

    switch (phase) {
      case 'ascend': {
        const t = clamp01(body.userData.eagleDivePhaseT / C.EAGLE_DIVE_ASCEND_DUR);
        const e = C.easeOutCubic(t);
        body.userData.flightLift = C.EAGLE_DIVE_APEX * e;
        body.userData.flightTilt = -0.18 * Math.sin(t * Math.PI);
        body.userData.flightRoll = Math.sin(t * Math.PI * 2) * 0.18;
        body.userData.flightSquash = 1 + 0.12 * Math.sin(t * Math.PI);
        body.userData.slamming = false;
        body.userData.eagleDiveSlamming = false;
        shared.homingXZ(body, opp, 2.4 * dt);
        setBodyCollisions(body, false);
        if (t >= 1) {
          body.userData.eagleDivePhase = 'hover';
          body.userData.eagleDivePhaseT = 0;
        }
        break;
      }
      case 'hover': {
        const t = clamp01(body.userData.eagleDivePhaseT / C.EAGLE_DIVE_HOVER_DUR);
        body.userData.flightLift = C.EAGLE_DIVE_APEX + Math.sin(t * Math.PI) * 1.2;
        body.userData.flightTilt = 0.1 * Math.sin(t * Math.PI);
        body.userData.flightRoll = Math.sin(t * Math.PI * 2) * 0.12;
        body.userData.flightSquash = 1;
        body.userData.slamming = false;
        body.userData.eagleDiveSlamming = false;
        // Keep tracking the live opponent position during hover — target locks only at dive start.
        shared.homingXZ(body, opp, 7 * dt);
        setBodyCollisions(body, false);
        if (t >= 1) {
          shared.lockEagleDiveTarget(body, opp);
          body.userData.eagleDivePhase = 'dive';
          body.userData.eagleDivePhaseT = 0;
        }
        break;
      }
      case 'dive': {
        const t = clamp01(body.userData.eagleDivePhaseT / C.EAGLE_DIVE_DUR);
        const e = C.easeInQuad(t);
        shared.moveTowardEagleDiveTarget(body, 11 * dt);
        body.userData.flightLift = C.EAGLE_DIVE_APEX * (1 - e);
        body.userData.flightTilt = -Math.PI * 0.38 * C.easeOutQuad(t);
        body.userData.flightRoll = Math.PI * 0.22 * Math.sin(t * Math.PI);
        body.userData.flightSquash = 1 + 0.2 * e;
        body.userData.slamming = true;
        body.userData.eagleDiveSlamming = true;
        if (e >= 1 || body.userData.flightLift <= 0.2) {
          body.userData.flightLift = 0;
          body.userData.eagleImpactFlash = true;
          if (shared.starBlastOverlap(body, opp)) markEagleDiveHit(state, side, body, opp);
          body.userData.eagleDiveSettleTilt = body.userData.flightTilt;
          body.userData.eagleDiveSettleRoll = body.userData.flightRoll;
          body.userData.eagleDivePhase = 'settle';
          body.userData.eagleDivePhaseT = 0;
          body.userData.slamming = false;
          body.userData.eagleDiveSlamming = false;
          setBodyCollisions(body, true);
        } else {
          setBodyCollisions(body, false);
        }
        break;
      }
      case 'settle': {
        const t = clamp01(body.userData.eagleDivePhaseT / C.EAGLE_DIVE_SETTLE_DUR);
        const decay = (1 - t) * (1 - t);
        body.userData.eagleImpactFlash = t < 0.18;
        body.userData.flightLift = Math.abs(Math.sin(t * Math.PI * 2)) * 0.26 * decay;
        body.userData.flightTilt = (body.userData.eagleDiveSettleTilt ?? 0) * (1 - C.easeOutCubic(t));
        body.userData.flightRoll = (body.userData.eagleDiveSettleRoll ?? 0) * (1 - C.easeOutCubic(t));
        body.userData.flightSquash = 1 - 0.16 * (1 - t) + 0.08 * Math.sin(t * Math.PI) * decay;
        body.userData.slamming = false;
        body.userData.eagleDiveSlamming = false;
        setBodyCollisions(body, true);
        if (t >= 1) shared.finishEagleDive(state, side, spSlot, body, dt);
        break;
      }
      default:
        body.userData.eagleDivePhase = 'ascend';
        body.userData.eagleDivePhaseT = 0;
        break;
    }
  }
}

// ---- Libra cinematic visual driver (render rate) ----------------------------

/**
 * Per-frame body animation for Flame Libra's Sonic Shield and Sonic Buster.
 */
