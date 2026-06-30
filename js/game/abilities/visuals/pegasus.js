import { CONFIG } from '../../config.js';
import { setBodyCollisions } from '../../physics/top.js';
import { clamp01 } from '../../utils/math.js';
import * as shared from '../shared.js';
import * as C from '../constants.js';
import { spinKey } from '../shared.js';

export function tickAbilityVisuals(state, dt) {
  if (!state.abilities) return;
  for (const side of ['player', 'ai']) {
    const slot = state.abilities[side]?.special;
    if (!slot || slot.ability.id !== 'pegasus_star_blast') continue;

    const body = side === 'player' ? state.playerBody : state.aiBody;
    const opp = side === 'player' ? state.aiBody : state.playerBody;
    if (!body) continue;

    const inMove =
      slot.windupRemaining > 0 ||
      slot.active ||
      body.userData.starBlastWindup ||
      body.userData.starPhase != null;
    if (!inMove) continue;

    const floor = C.groundY(body);
    body.position.y = floor;
    body.velocity.set(0, 0, 0);

    if (slot.windupRemaining > 0 || body.userData.starBlastWindup) {
      // Anticipation: crouch on the floor (no lift) while the logo flash plays.
      const windup = C.slotWindupTotal(slot, 0.5);
      const t = clamp01(windup > 0 ? 1 - slot.windupRemaining / windup : 1);
      body.userData.flightLift = 0;
      body.userData.flightTilt = 0.1 * C.easeOutQuad(t);
      body.userData.flightRoll = 0;
      body.userData.flightSquash = 1 - 0.15 * C.easeOutQuad(t);
      body.userData.slamming = false;
      setBodyCollisions(body, false);
      continue;
    }

    if (!slot.active) {
      if (body.userData.controlLocked) {
        shared.resolveStarBlastOutcome(state, side, body);
        shared.releaseStarBlastControl(body);
      }
      continue;
    }

    const phase = body.userData.starPhase;
    if (!phase) {
      shared.finishStarBlast(state, side, slot, body, dt);
      continue;
    }

    body.userData.starPhaseT = (body.userData.starPhaseT ?? 0) + dt;
    body.userData.flightSquash = body.userData.flightSquash ?? 1;

    const oppSide = side === 'player' ? 'ai' : 'player';
    const oppSleeping =
      body.userData.starBlastHit && state[spinKey(oppSide)] <= CONFIG.SPIN_STOPPED;

    switch (phase) {
      // 1) Accelerating dash toward the wall, leaning into the run.
      case 'dash': {
        body.userData.slamming = false;
        body.userData.flightLift = 0;
        const tx = body.userData.starWallX ?? 0;
        const tz = body.userData.starWallZ ?? 0;
        if (body.userData.starDashFromX == null) {
          body.userData.starDashFromX = body.position.x;
          body.userData.starDashFromZ = body.position.z;
        }
        const t = clamp01(body.userData.starPhaseT / C.STAR_DASH_DUR);
        const e = C.easeInQuad(t); // smooth, gradual build of speed into the wall
        body.position.x = body.userData.starDashFromX + (tx - body.userData.starDashFromX) * e;
        body.position.z = body.userData.starDashFromZ + (tz - body.userData.starDashFromZ) * e;
        body.userData.flightTilt = 0.12 + 0.34 * e; // lean forward as it speeds up
        body.userData.flightSquash = 1 + 0.1 * e; // stretch in the direction of travel
        if (t >= 1) {
          body.position.x = tx;
          body.position.z = tz;
          body.userData.starImpactX = tx;
          body.userData.starImpactZ = tz;
          body.userData.starPhase = 'ascend';
          body.userData.starPhaseT = 0;
          body.userData.starImpactFlash = true;
          delete body.userData.starDashFromX;
          delete body.userData.starDashFromZ;
        }
        setBodyCollisions(body, false);
        break;
      }

      // 2) Wall hit + continuous elevation in one arc (no plateau between kicks).
      case 'ascend': {
        if (oppSleeping) {
          body.userData.starPhase = 'settle';
          body.userData.starPhaseT = C.STAR_SETTLE_DUR * 0.82;
          body.userData.flightLift = 0;
          body.userData.flightTilt = 0;
          body.userData.flightRoll = 0;
          body.userData.flightSquash = 1;
          body.userData.slamming = false;
          break;
        }
        body.userData.slamming = false;
        const t = clamp01(body.userData.starPhaseT / C.STAR_ASCEND_DUR);
        const ix = body.userData.starImpactX ?? body.position.x;
        const iz = body.userData.starImpactZ ?? body.position.z;
        const nx = body.userData.starWallNx ?? 0;
        const nz = body.userData.starWallNz ?? 0;
        const wallFrac = C.STAR_WALL_IMPACT_DUR / C.STAR_ASCEND_DUR;

        // Horizontal recoil + squash only during the opening wall-contact window.
        if (t < wallFrac) {
          const wt = clamp01(t / wallFrac);
          const recoil = C.easeOutBack(wt) * C.STAR_WALL_RECOIL;
          body.position.x = ix + nx * recoil;
          body.position.z = iz + nz * recoil;
          const compress = Math.sin(clamp01(wt / 0.4) * Math.PI * 0.5);
          const release = clamp01((wt - 0.4) / 0.6);
          body.userData.flightSquash = 1 - 0.42 * compress + 0.3 * C.easeOutQuad(release);
          body.userData.flightTilt = -0.7 * Math.sin(wt * Math.PI);
          body.userData.starImpactFlash = wt < 0.45;
        } else {
          body.position.x = ix + nx * C.STAR_WALL_RECOIL;
          body.position.z = iz + nz * C.STAR_WALL_RECOIL;
          body.userData.starImpactFlash = false;
          body.userData.flightSquash = 1 + 0.12 * (1 - t);
        }

        // Single smooth lift curve: starts moving up immediately off the wall,
        // eases into the apex, then hands straight off to the dive.
        body.userData.flightLift = C.STAR_APEX * Math.sin(t * Math.PI * 0.5);
        if (t > wallFrac) {
          body.userData.flightTilt = -0.45 * (1 - t);
        }
        body.userData.flightRoll = 0;
        shared.homingXZ(body, opp, Math.min(1, (3 + 5 * t) * dt));

        if (t >= 1) {
          body.userData.starPhase = 'dive';
          body.userData.starPhaseT = 0;
        }
        setBodyCollisions(body, false);
        break;
      }

      // 3) Accelerating plunge, pitched to show the underside, homing onto foe.
      case 'dive': {
        if (oppSleeping) {
          body.userData.starPhase = 'settle';
          body.userData.starPhaseT = C.STAR_SETTLE_DUR * 0.82;
          body.userData.flightLift = 0;
          body.userData.flightTilt = 0;
          body.userData.flightRoll = 0;
          body.userData.flightSquash = 1;
          body.userData.slamming = false;
          setBodyCollisions(body, true);
          break;
        }
        body.userData.slamming = true;
        const t = clamp01(body.userData.starPhaseT / C.STAR_DIVE_DUR);
        const e = C.easeInQuad(t); // gentler, slower-looking acceleration
        shared.homingXZ(body, opp, 8 * dt);
        body.userData.flightLift = C.STAR_APEX * (1 - e);
        body.userData.flightTilt = C.STAR_FALL_PITCH * C.easeOutQuad(t);
        body.userData.flightRoll = C.STAR_FALL_ROLL * C.easeOutQuad(t);
        body.userData.flightSquash = 1 + 0.24 * e; // elongates as it speeds up
        if (e >= 1 || body.userData.flightLift <= C.STAR_LAND_LIFT) {
          body.userData.flightLift = 0;
          body.userData.starVY = C.STAR_BOUNCE_VELOCITY;
          body.userData.starBouncePulseT = 0;
          shared.applyStarBounceKnockback(body, opp, C.STAR_BOUNCE_VELOCITY);
          if (shared.starBlastOverlap(body, opp)) shared.markStarBlastHit(state, side, body, opp);
          body.userData.starPhase = 'bounce';
          body.userData.starPhaseT = 0;
          setBodyCollisions(body, true);
        } else {
          setBodyCollisions(body, false);
        }
        break;
      }

      // 6) Real decaying bounces: integrate velocity + gravity, squash on each
      //    contact, and progressively right itself to upright.
      case 'bounce': {
        if (oppSleeping) {
          body.userData.starPhase = 'settle';
          body.userData.starPhaseT = C.STAR_SETTLE_DUR * 0.82;
          body.userData.flightLift = 0;
          body.userData.flightTilt = 0;
          body.userData.flightRoll = 0;
          body.userData.flightSquash = 1;
          body.userData.slamming = false;
          delete body.userData.starVY;
          break;
        }
        body.userData.slamming = body.userData.starVY > 0; // only damages going up off the slam
        let vy = body.userData.starVY ?? 0;
        vy -= C.STAR_BOUNCE_GRAVITY * dt;
        let lift = (body.userData.flightLift ?? 0) + vy * dt;
        body.userData.starBouncePulseT = (body.userData.starBouncePulseT ?? 0) + dt;

        if (lift <= 0) {
          lift = 0;
          const contactSpeed = Math.abs(vy);
          if (contactSpeed < C.STAR_BOUNCE_MIN_V) {
            // Too slow to bounce again — settle upright.
            body.userData.flightLift = 0;
            body.userData.starSettleTilt = body.userData.flightTilt ?? 0;
            body.userData.starSettleRoll = body.userData.flightRoll ?? 0;
            body.userData.starPhase = 'settle';
            body.userData.starPhaseT = 0;
            body.userData.slamming = false;
            break;
          }
          vy = contactSpeed * C.STAR_BOUNCE_RESTITUTION;
          body.userData.starBouncePulseT = 0;
          body.userData.flightTilt = (body.userData.flightTilt ?? 0) * 0.45;
          body.userData.flightRoll = (body.userData.flightRoll ?? 0) * 0.45;

          // Modest knockback away from the opponent on each bounce.
          shared.applyStarBounceKnockback(body, opp, contactSpeed);
        }

        body.userData.starVY = vy;
        body.userData.flightLift = lift;

        // Squash pulse driven off each ground contact: flatten hard on impact,
        // spring back through a slight stretch, then settle to neutral.
        const pulse = clamp01(body.userData.starBouncePulseT / C.STAR_BOUNCE_PULSE_DUR);
        const stretch = 0.12 * Math.sin(pulse * Math.PI) *
          clamp01(Math.abs(vy) / C.STAR_BOUNCE_VELOCITY);
        body.userData.flightSquash = 1 - 0.4 * (1 - pulse) + stretch;

        const rightRate = 1 - Math.pow(C.STAR_BOUNCE_UPRIGHT_RATE, dt);
        body.userData.flightTilt *= 1 - rightRate;
        body.userData.flightRoll *= 1 - rightRate;
        setBodyCollisions(body, true);
        break;
      }

      // 7) Regain balance: a few little decaying hops with a slow, gentle sway.
      case 'settle': {
        body.userData.slamming = false;
        const t = clamp01(body.userData.starPhaseT / C.STAR_SETTLE_DUR);
        const decay = (1 - t) * (1 - t); // amplitude eases smoothly to zero

        // Little hops that get shorter each time (|sin| gives evenly spaced arches).
        const hops = Math.abs(Math.sin(t * Math.PI * C.STAR_SETTLE_HOPS)) *
          C.STAR_SETTLE_HOP_HEIGHT * decay;
        body.userData.flightLift = hops;

        // Slow sway that decays, plus any residual tilt easing back to upright.
        const sway = Math.sin(t * Math.PI * C.STAR_SETTLE_WOBBLES) *
          C.STAR_SETTLE_WOBBLE_AMP * decay;
        const settleEase = 1 - C.easeOutCubic(t);
        body.userData.flightTilt = (body.userData.starSettleTilt ?? 0) * settleEase + sway;
        body.userData.flightRoll = (body.userData.starSettleRoll ?? 0) * settleEase;

        // Squat a touch each time a hop taps the floor.
        const grounded = 1 - clamp01(hops / (C.STAR_SETTLE_HOP_HEIGHT * 0.35));
        body.userData.flightSquash = 1 - 0.1 * grounded * decay;

        setBodyCollisions(body, true);
        if (t >= 1) {
          body.userData.flightLift = 0;
          body.userData.flightTilt = 0;
          body.userData.flightRoll = 0;
          body.userData.flightSquash = 1;
          shared.finishStarBlast(state, side, slot, body, dt);
        }
        break;
      }

      default:
        shared.finishStarBlast(state, side, slot, body, dt);
        break;
    }

    shared.integrateStarKnockback(body, dt);

    // Failsafe: move slot ended but controls/physics still cinematic.
    if (!slot.active && slot.windupRemaining <= 0 && body.userData.controlLocked) {
      shared.resolveStarBlastOutcome(state, side, body);
      shared.releaseStarBlastControl(body);
    }
  }
}
