import { CONFIG } from '../../config.js';
import { setBodyCollisions } from '../../physics/top.js';
import { clamp01 } from '../../utils/math.js';
import * as shared from '../shared.js';
import * as C from '../constants.js';

export function tickBullAbilityVisuals(state, dt) {
  if (!state.abilities) return;

  for (const side of ['player', 'ai']) {
    const body = side === 'player' ? state.playerBody : state.aiBody;
    const opp = side === 'player' ? state.aiBody : state.playerBody;
    if (!body) continue;
    const runtime = state.abilities[side];
    if (!runtime) continue;

    const pwSlot = runtime.power;
    if (pwSlot?.active && pwSlot.ability.id === 'bull_maximum_stampede') {
      const t = body.userData.stampedeT ?? 0;
      body.userData.stampedeT = t + dt;
      const pulse = 0.5 + 0.5 * Math.sin(t * 9);
      body.userData.flightSquash = 1 - 0.05 * pulse;
      body.userData.flightTilt = 0.04 * pulse;
    }

    const spSlot = runtime.special;
    if (!spSlot || spSlot.ability.id !== 'bull_red_horn_uppercut') continue;

    const inMove =
      spSlot.windupRemaining > 0 ||
      spSlot.active ||
      body.userData.bullUpperPhase != null;
    if (!inMove) continue;

    const floor = C.groundY(body);
    body.position.y = floor;
    body.velocity.set(0, 0, 0);
    setBodyCollisions(body, false);
    if (body.type !== CANNON.Body.KINEMATIC) shared.setAirborneKinematic(body);

    if (body.userData.bullImpactFlash) {
      body.userData.bullImpactFlashT = (body.userData.bullImpactFlashT ?? 0) + dt;
      if (body.userData.bullImpactFlashT > 0.15) {
        body.userData.bullImpactFlash = false;
        delete body.userData.bullImpactFlashT;
      }
    }

    if (spSlot.windupRemaining > 0) {
      body.userData.bullUpperPhase = 'windup';
      const windup = C.slotWindupTotal(spSlot, C.BULL_UPPERCUT_WINDUP);
      const t = clamp01(1 - spSlot.windupRemaining / windup);
      const e = C.easeInOutCubic(t);
      // Late windup: slide toward the foe so the dash line is fresher at launch.
      if (t > 0.5 && opp) shared.homingXZ(body, opp, 5 * dt);
      body.userData.flightLift = 0;
      body.userData.bullWindupEndTilt = 0.12 * C.easeOutCubic(t);
      body.userData.flightTilt = body.userData.bullWindupEndTilt;
      body.userData.flightRoll = Math.sin(t * Math.PI) * 0.025;
      body.userData.flightSquash = 1 - 0.14 * e;
      continue;
    }

    if (!spSlot.active && body.userData.bullUpperPhase !== 'dash') continue;

    const phase = body.userData.bullUpperPhase ?? 'dash';

    switch (phase) {
      case 'dash': {
        body.userData.bullUpperSlamming = true;
        const phaseT = body.userData.bullUpperPhaseT ?? 0;
        const build = C.easeOutCubic(clamp01(phaseT / C.BULL_DASH_BUILD_DUR));
        const fromTilt = body.userData.bullWindupEndTilt ?? 0.12;
        body.userData.flightTilt = fromTilt + (C.BULL_DASH_LEAN - fromTilt) * build;
        body.userData.flightSquash = 1 + 0.05 * build;
        body.userData.flightRoll = (body.userData.bullCoastNz ?? 0) * 0.045 * build;

        if (body.userData.bullDashDone) {
          delete body.userData.bullDashDone;
          body.userData.bullUpperSlamming = false;
          shared.finishBullUppercut(state, side, spSlot, body, dt);
        }
        break;
      }
      default:
        break;
    }

    // Failsafe: slot ended but attacker still cinematic / locked.
    if (!spSlot.active && spSlot.windupRemaining <= 0 && body.userData.controlLocked) {
      shared.resolveBullUppercutOutcome(state, side, body);
      shared.releaseBullUppercutControl(body);
    }
  }
}
