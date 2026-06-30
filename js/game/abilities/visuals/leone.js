import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { clamp01 } from '../../../utils/math.js';
import * as shared from '../shared.js';
import * as C from '../constants.js';

export function tickLeoneAbilityVisuals(state, dt) {
  if (!state.abilities) return;
  for (const side of ['player', 'ai']) {
    const body = side === 'player' ? state.playerBody : state.aiBody;
    if (!body) continue;
    const runtime = state.abilities[side];
    if (!runtime) continue;

    // --- Wide Ball Anchor (power) ---
    const pwSlot = runtime.power;
    if (pwSlot?.active && pwSlot.ability.id === 'leone_wide_ball') {
      const t = body.userData.leoneAnchorT ?? 0;
      body.userData.leoneAnchorT = t + dt;

      if (t < C.LEONE_DIG_DUR) {
        const e = C.easeOutQuad(t / C.LEONE_DIG_DUR);
        body.userData.flightSquash = 1 - (1 - C.LEONE_SQUASH_HOLD) * e;
        body.userData.flightTilt = 0.06 * e;
      } else {
        // Hold: squash locked, slow micro-shake to feel grounded.
        body.userData.flightSquash = C.LEONE_SQUASH_HOLD;
        const shake = Math.sin(t * 38) * C.LEONE_SHAKE_AMP * 0.6
                    + Math.sin(t * 21) * C.LEONE_SHAKE_AMP * 0.4;
        body.userData.flightTilt = 0.06 + shake;
        body.userData.flightRoll = Math.sin(t * 27) * C.LEONE_SHAKE_AMP * 0.35;
      }
      continue;
    }

    // --- Lion Gale Force Wall (special) ---
    const spSlot = runtime.special;
    if (!spSlot || spSlot.ability.id !== 'leone_lion_wall') continue;

    const inWindup = spSlot.windupRemaining > 0;
    const inActive = spSlot.active;
    if (!inWindup && !inActive) continue;

    if (inWindup) {
      const windup = shared.slotWindupTotal(spSlot, 0.45);
      const t = clamp01(1 - spSlot.windupRemaining / windup);
      const rise = C.easeOutQuad(t);
      // Rise into the gale during windup.
      body.userData.contactLift = C.LEONE_WALL_HOVER_BASE * rise;
      body.userData.flightSquash = 1 - 0.12 * rise;
      body.userData.flightTilt = 0.08 * rise;
      body.userData.flightRoll = 0;
      body.userData.flightLift = body.userData.contactLift;
    } else {
      // Active: high hover + slow bob — out of ground contact range.
      const wt = body.userData.lionWallT ?? 0;
      body.userData.lionWallT = wt + dt;
      const dur = spSlot.ability.duration || C.LEONE_WALL_DURATION;
      const progress = clamp01(1 - spSlot.activeRemaining / dur);
      const fadeIn = C.easeOutQuad(Math.min(1, wt / 0.25));
      const fadeOut = progress > 0.8 ? C.easeOutQuad((1 - progress) / 0.2) : 1;
      const env = fadeIn * fadeOut;
      const bob = Math.sin(wt * 4.2) * C.LEONE_WALL_HOVER_BOB * env;

      body.userData.contactLift = C.LEONE_WALL_HOVER_BASE * env + bob;
      body.userData.flightSquash = 1 - 0.14 * env;
      body.userData.flightLift = body.userData.contactLift;
      body.userData.flightRoll = Math.sin(wt * 2.8) * 0.11 * env;
      body.userData.flightTilt = 0.06 * env;

      // Decay the burst signal each frame so VFX has a timed window to read it.
      if (body.userData.lionWallBurstT != null) {
        body.userData.lionWallBurstT -= dt * 8;
        if (body.userData.lionWallBurstT <= 0) delete body.userData.lionWallBurstT;
      }
    }
  }
}
