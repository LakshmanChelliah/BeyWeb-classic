import { CONFIG } from '../../config.js';
import { setBodyCollisions } from '../../physics/top.js';
import { clamp01 } from '../../utils/math.js';
import * as shared from '../shared.js';
import * as C from '../constants.js';

export function tickLibraAbilityVisuals(state, dt) {
  if (!state.abilities) return;
  shared.stepLibraBusterChannel(state, dt);
  for (const side of ['player', 'ai']) {
    const body = side === 'player' ? state.playerBody : state.aiBody;
    if (!body) continue;
    const runtime = state.abilities[side];
    if (!runtime) continue;

    const pwSlot = runtime.power;
    if (pwSlot?.active && pwSlot.ability.id === 'libra_sonic_shield') {
      const t = body.userData.sonicShieldT ?? 0;
      body.userData.sonicShieldT = t + dt;
      const pulse = 0.5 + 0.5 * Math.sin(t * 5.2);
      body.userData.flightSquash = 1 - 0.06 * pulse;
      body.userData.flightRoll = Math.sin(t * 3.4) * 0.04;
      body.userData.flightTilt = 0.03 * pulse;
      if (body.userData.sonicShieldBurstT != null) {
        body.userData.sonicShieldBurstT -= dt * 7;
        if (body.userData.sonicShieldBurstT <= 0) delete body.userData.sonicShieldBurstT;
      }
      continue;
    }

    const spSlot = runtime.special;
    if (!spSlot || spSlot.ability.id !== 'libra_sonic_buster') continue;

    const inWindup = spSlot.windupRemaining > 0 || body.userData.sonicBusterWindup;
    const inActive = spSlot.active;
    if (!inWindup && !inActive) continue;

    const vt = (body.userData.sonicBusterVibrateT ?? 0) + dt;
    body.userData.sonicBusterVibrateT = vt;
    const w = C.LIBRA_BUSTER_VIBRATE_HZ * Math.PI * 2;
    const phase = vt * w;
    const bob = Math.sin(phase);
    body.userData.sonicBusterVisualSpinMult = C.LIBRA_BUSTER_VISUAL_SPIN;
    body.userData.flightLift = bob * C.LIBRA_BUSTER_VIBRATE_LIFT;
    body.userData.flightSquash = 1 - bob * 0.1;
    body.userData.flightOffsetX = Math.sin(phase) * C.LIBRA_BUSTER_VIBRATE_XY;
    body.userData.flightOffsetZ = Math.sin(phase + Math.PI * 0.5) * C.LIBRA_BUSTER_VIBRATE_XY;
    body.userData.flightTilt = 0;
    body.userData.flightRoll = 0;
  }
}

// ---- L-Drago cinematic visual driver (render rate) --------------------------

/**
 * Per-frame body animation for L-Drago Spin Steal and Soaring Destruction.
 */
