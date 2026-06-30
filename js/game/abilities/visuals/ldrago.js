import { CONFIG } from '../../config.js';
import { setBodyCollisions } from '../../physics/top.js';
import { clamp01 } from '../../utils/math.js';
import * as shared from '../shared.js';
import * as C from '../constants.js';

export function tickLdragoAbilityVisuals(state, dt) {
  if (!state.abilities) return;
  for (const side of ['player', 'ai']) {
    const body = side === 'player' ? state.playerBody : state.aiBody;
    const opp = side === 'player' ? state.aiBody : state.playerBody;
    if (!body) continue;
    const runtime = state.abilities[side];
    if (!runtime) continue;

    // --- Spin Steal (power) ---
    const pwSlot = runtime.power;
    if (pwSlot?.active && pwSlot.ability.id === 'ldrago_spin_steal') {
      body.userData.spinStealT = (body.userData.spinStealT ?? 0) + dt;
      body.userData.flightRoll = Math.sin(body.userData.spinStealT * 4.5) * 0.05;
      if (body.userData.spinStealBurstT != null) {
        body.userData.spinStealBurstT -= dt * 6;
        if (body.userData.spinStealBurstT <= 0) {
          delete body.userData.spinStealBurstT;
          delete body.userData.spinStealFromX;
          delete body.userData.spinStealFromZ;
        }
      }
      continue;
    }

    // --- Absorb Break (special) ---
    const spAbsorb = runtime.special;
    if (spAbsorb?.ability?.id === 'ldrago_absorb_break') {
      const inWindup = spAbsorb.windupRemaining > 0 || body.userData.ldragoAbsorbWindup;
      const inActive = spAbsorb.active;
      const inMove = inWindup || inActive || body.userData.ldragoAbsorbPhase != null;
      if (inMove) {
        body.position.y = C.groundY(body);
        body.velocity.set(0, 0, 0);
        setBodyCollisions(body, false);
        if (body.type !== CANNON.Body.KINEMATIC) shared.setAirborneKinematic(body);

        if (body.userData.ldragoAbsorbImpact) {
          body.userData.ldragoAbsorbImpactT = (body.userData.ldragoAbsorbImpactT ?? 0) + dt;
          if (body.userData.ldragoAbsorbImpactT > 0.18) {
            body.userData.ldragoAbsorbImpact = false;
            delete body.userData.ldragoAbsorbImpactT;
          }
        }

        if (inWindup) {
          const windup = C.slotWindupTotal(spAbsorb, C.LDRAGO_ABSORB_WINDUP);
          const t = clamp01(windup > 0 ? 1 - spAbsorb.windupRemaining / windup : 1);
          if (opp && t > 0.2) shared.pullTowardAbsorb(body, opp, C.LDRAGO_ABSORB_PULL_RATE * dt);
          body.userData.flightLift = 0;
          body.userData.ldragoAbsorbCoilTilt = 0.18 * C.easeOutQuad(t);
          body.userData.flightTilt = body.userData.ldragoAbsorbCoilTilt;
          body.userData.flightRoll = Math.sin(t * Math.PI * 4) * 0.06;
          body.userData.flightSquash = 1 - 0.16 * C.easeOutQuad(t);
          continue;
        }

        if (inActive) {
          const phaseT = body.userData.ldragoAbsorbPhaseT ?? 0;
          const coilTilt = body.userData.ldragoAbsorbCoilTilt ?? 0.18;
          const lean = 0.36;
          const build = C.easeOutCubic(clamp01(phaseT / 0.2));
          body.userData.flightTilt = coilTilt + (lean - coilTilt) * build;
          body.userData.flightSquash = 1 + 0.05 * build;
          body.userData.flightRoll = (body.userData.ldragoAbsorbNz ?? 0) * 0.06 * build;
          if (body.userData.ldragoAbsorbDashDone) {
            delete body.userData.ldragoAbsorbDashDone;
            body.userData.ldragoAbsorbRush = false;
            shared.finishLdragoAbsorb(state, side, spAbsorb, body, dt);
          }
          continue;
        }
      }
    }

    // --- Soaring Destruction (special) ---
    const spSlot = runtime.special;
    if (!spSlot || spSlot.ability.id !== 'ldrago_soaring_destruction') continue;

    const inWindup = spSlot.windupRemaining > 0;
    const inActive = spSlot.active;
    if (!inWindup && !inActive && !body.userData.ldragoFlightWindup) continue;

    if (inWindup || body.userData.ldragoFlightWindup) {
      const windup = shared.slotWindupTotal(spSlot, C.LDRAGO_FLIGHT_WINDUP);
      const t = clamp01(1 - spSlot.windupRemaining / windup);
      body.userData.flightSquash = 1 - 0.14 * C.easeOutQuad(t);
      body.userData.flightTilt = 0.16 * C.easeOutQuad(t);
      body.userData.flightRoll = Math.sin(t * Math.PI * 3) * 0.04;
      body.userData.flightLift = 0;
    } else if (inActive) {
      const ft = body.userData.ldragoFlightT ?? 0;
      const dur = spSlot.ability.duration || C.LDRAGO_FLIGHT_DURATION;
      const remaining = spSlot.activeRemaining;
      const inLand = remaining <= C.LDRAGO_FLIGHT_LAND_DUR;
      const reriseStart = C.LDRAGO_FLIGHT_LAUNCH_DUR;
      const reriseEnd = reriseStart + C.LDRAGO_LIGHTNING_CHARGE_DUR;
      const inLaunch = !inLand && ft < C.LDRAGO_FLIGHT_LAUNCH_DUR;
      const inRerise = !inLand && ft >= reriseStart && ft < reriseEnd;

      if (inLaunch) {
        const t = C.easeOutQuad(clamp01(ft / C.LDRAGO_FLIGHT_LAUNCH_DUR));
        body.userData.flightLift = C.LDRAGO_FLIGHT_APEX * C.LDRAGO_FLIGHT_LAUNCH_PEAK * t;
        body.userData.flightSquash = 1 + 0.06 * t;
        body.userData.flightTilt = -0.08 * C.easeOutQuad(t);
        body.userData.flightRoll = Math.sin(ft * 2.4) * 0.04 * t;
      } else if (inRerise) {
        const t = C.easeOutQuad(clamp01((ft - reriseStart) / C.LDRAGO_LIGHTNING_CHARGE_DUR));
        const peak = C.LDRAGO_FLIGHT_LAUNCH_PEAK + (1 - C.LDRAGO_FLIGHT_LAUNCH_PEAK) * t;
        body.userData.flightLift = C.LDRAGO_FLIGHT_APEX * peak;
        body.userData.flightSquash = 1 + 0.04 * (1 - t);
        body.userData.flightTilt = -0.06 * (1 - t);
        body.userData.flightRoll = Math.sin(ft * 2.2) * 0.06;
      } else if (inLand) {
        const landT = clamp01(remaining / C.LDRAGO_FLIGHT_LAND_DUR);
        body.userData.flightLift = C.LDRAGO_FLIGHT_APEX * C.easeOutQuad(landT);
        body.userData.flightSquash = 1 - 0.22 * (1 - landT);
        body.userData.flightTilt = 0.04 * landT;
        body.userData.flightRoll = Math.sin(landT * Math.PI) * 0.08 * landT;
      } else {
        const bob = Math.sin(ft * 2.6) * C.LDRAGO_FLIGHT_BOB;
        body.userData.flightLift = C.LDRAGO_FLIGHT_APEX + bob;
        body.userData.flightSquash = 1 - 0.08;
        body.userData.flightRoll = Math.sin(ft * 2.0) * 0.1;
        body.userData.flightTilt = 0.06 + Math.sin(ft * 1.8) * 0.03;
      }

      if (body.userData.flightRepulseT != null) {
        body.userData.flightRepulseT -= dt * 5;
        if (body.userData.flightRepulseT <= 0) delete body.userData.flightRepulseT;
      }
      if (body.userData.ldragoFlightLaunchT != null) {
        body.userData.ldragoFlightLaunchT -= dt * 2;
        if (body.userData.ldragoFlightLaunchT <= 0) delete body.userData.ldragoFlightLaunchT;
      }

      const chargeStart = C.LDRAGO_FLIGHT_LAUNCH_DUR;
      const chargeEnd = chargeStart + C.LDRAGO_LIGHTNING_CHARGE_DUR;
      body.userData.ldragoLightningCharging = ft >= chargeStart && ft < chargeEnd;
      body.userData.ldragoFlightRerising = inRerise;
    }
  }
}

/** True while Pegasus Star Blast should show the blue emissive glow. */
