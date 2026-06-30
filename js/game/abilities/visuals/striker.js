import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { clamp01 } from '../../../utils/math.js';
import * as shared from '../shared.js';
import { spinKey } from '../shared.js';
import * as C from '../constants.js';

export function tickStrikerAbilityVisuals(state, dt) {
  if (!state.abilities) return;

  for (const side of ['player', 'ai']) {
    const body = side === 'player' ? state.playerBody : state.aiBody;
    if (!body) continue;
    const runtime = state.abilities[side];
    if (!runtime) continue;

    const pwSlot = runtime.power;
    if (pwSlot?.active && pwSlot.ability.id === 'striker_blitz_charge') {
      const t = body.userData.boostT ?? 0;
      body.userData.boostT = t + dt;
      const pulse = 0.5 + 0.5 * Math.sin(t * 11);
      body.userData.flightSquash = 1 - 0.04 * pulse;
      body.userData.flightTilt = 0.05 * pulse;
    }

    const spSlot = runtime.special;
    if (!spSlot || spSlot.ability.id !== 'striker_lightning_flash') continue;

    const inMove =
      spSlot.windupRemaining > 0 ||
      spSlot.active ||
      body.userData.strikerFlashPhase != null;
    if (!inMove) continue;

    if (body.userData.strikerImpactFlash) {
      body.userData.strikerImpactFlashT = (body.userData.strikerImpactFlashT ?? 0) + dt;
      if (body.userData.strikerImpactFlashT > 0.12) {
        body.userData.strikerImpactFlash = false;
        delete body.userData.strikerImpactFlashT;
      }
    }

    if (spSlot.windupRemaining > 0) {
      const windup = C.slotWindupTotal(spSlot, C.STRIKER_FLASH_WINDUP);
      const t = clamp01(1 - spSlot.windupRemaining / windup);
      body.userData.flightLift = 0;
      body.userData.strikerWindupEndTilt = 0.14 * C.easeOutCubic(t);
      body.userData.flightTilt = body.userData.strikerWindupEndTilt;
      body.userData.flightRoll = Math.sin(t * Math.PI * 2) * 0.03;
      body.userData.flightSquash = 1 - 0.12 * C.easeOutQuad(t);
      continue;
    }

    if (!spSlot.active && body.userData.strikerFlashPhase == null) continue;

    const phase = body.userData.strikerFlashPhase;
    const phaseT = body.userData.strikerFlashPhaseT ?? 0;

    if (phase === 'vanish') {
      const t = clamp01(phaseT / C.STRIKER_VANISH_DUR);
      body.userData.topVanish = C.easeInQuad(t);
      body.userData.flightSquash = 1 - 0.22 * C.easeInQuad(t);
      body.userData.flightTilt = (body.userData.strikerWindupEndTilt ?? 0.14) * (1 - t);
      continue;
    }

    if (phase === 'reappear') {
      const t = clamp01(phaseT / C.STRIKER_REAPPEAR_DUR);
      body.userData.topVanish = 1 - C.easeOutCubic(t);
      body.userData.strikerReappearFlash = body.userData.strikerReappearFlash ?? 1 - t;
      body.userData.flightSquash = 0.82 + 0.18 * C.easeOutBack(t);
      body.userData.flightTilt = 0.2 * C.easeOutCubic(t);
      body.userData.flightRoll = (body.userData.strikerCoastNz ?? 0) * 0.04 * t;
      continue;
    }

    if (phase !== 'dash') continue;

    const lean = 0.32;
    const fromTilt = body.userData.strikerWindupEndTilt ?? 0.14;
    const build = C.easeOutCubic(clamp01(phaseT / 0.22));
    body.userData.flightTilt = fromTilt + (lean - fromTilt) * build;
    body.userData.flightSquash = 1 + 0.04 * build;
    body.userData.flightRoll = (body.userData.strikerCoastNz ?? 0) * 0.05 * build;
  }
}

// ---- Earth Eagle cinematic visual driver (render rate) -----------------------

function markEagleDiveHit(state, attackerSide, body, opp) {
  if (!body || body.userData.eagleDiveHit) return;
  if (opp?.userData?.invulnerable) return;
  body.userData.eagleDiveHit = true;
  const oppSide = attackerSide === 'player' ? 'ai' : 'player';
  const k = spinKey(oppSide);
  state[k] = Math.max(0, state[k] - C.EAGLE_DIVE_HIT_SPIN);
  if (opp) {
    const dx = opp.position.x - body.position.x;
    const dz = opp.position.z - body.position.z;
    const d = Math.hypot(dx, dz) || 1;
    shared.applyPhysicsKnockback(opp, dx / d, dz / d, C.STAR_BLAST_HIT_KNOCKBACK * 0.92);
  }
}

