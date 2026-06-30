import * as CANNON from 'cannon-es';
import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { isAtPocketAngle } from '../../../physics/arena.js';
import { clamp01 } from '../../../utils/math.js';
import * as C from '../constants.js';
import * as shared from '../shared.js';

export const libraAbilities = {
  libra_sonic_shield: {
    id: 'libra_sonic_shield',
    name: 'Sonic Shield',
    slot: 'power',
    icon: '\u25CE',
    desc: 'Green aura deflects rivals and their attacks away from Libra.',
    charge: 6.5,
    cooldown: 9,
    duration: C.LIBRA_SHIELD_DURATION,
    windup: 0,
    glow: '#4ade80',
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.guarding = true;
      b.userData.sonicShield = true;
      b.userData.sonicShieldPulse = 0;
      b.userData.sonicShieldT = 0;
      b.userData.sonicShieldReach =
        (b.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS) * C.LIBRA_SHIELD_REACH_MULT;
    },
    onStep(ctx) {
      const b = ctx.body;
      const opp = ctx.opponentBody;
      b.userData.sonicShieldPulse = (b.userData.sonicShieldPulse ?? 0) + ctx.dt;
      ctx.addSpin(-C.LIBRA_SHIELD_SELF_SPIN * ctx.dt, ctx.side);

      if (!opp || b.userData.sonicShieldPulse < C.LIBRA_SHIELD_PULSE) return;
      b.userData.sonicShieldPulse = 0;

      const rA = b.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
      const rB = opp.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
      const dx = opp.position.x - b.position.x;
      const dz = opp.position.z - b.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const reach = (rA + rB) * C.LIBRA_SHIELD_REACH_MULT;
      b.userData.sonicShieldReach = reach;
      if (dist >= reach) return;

      const falloff = 1 - dist / reach;
      const push = C.LIBRA_SHIELD_REPULSE * falloff;
      opp.velocity.x += (dx / dist) * push;
      opp.velocity.z += (dz / dist) * push;
      if (falloff > 0.22) {
        ctx.addSpin(-C.LIBRA_SHIELD_REPULSE_SPIN * falloff, ctx.oppSide);
        b.userData.sonicShieldBurstT = falloff;
      }
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.guarding = false;
      b.userData.sonicShield = false;
      delete b.userData.sonicShieldPulse;
      delete b.userData.sonicShieldT;
      delete b.userData.sonicShieldBurstT;
      delete b.userData.sonicShieldReach;
      b.userData.flightSquash = 1;
      b.userData.flightTilt = 0;
      b.userData.flightRoll = 0;
    },
  },

  libra_sonic_buster: {
    id: 'libra_sonic_buster',
    name: 'Sonic Buster',
    slot: 'special',
    icon: '\u25C9',
    desc: 'Rushes to center, bounces at sonic speed, and opens quicksand that sucks rivals inward.',
    charge: 12.5,
    cooldown: 13,
    duration: C.LIBRA_BUSTER_DURATION,
    windup: C.LIBRA_BUSTER_WINDUP_DUR,
    glow: '#a3e635',
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.sonicBuster = true;
      b.userData.sonicBusterWindup = false;
      b.userData.controlLocked = true;
      b.userData.sonicBusterT = 0;
      b.userData.sonicBusterX = 0;
      b.userData.sonicBusterZ = 0;
      b.position.x = 0;
      b.position.z = 0;
      b.velocity.set(0, 0, 0);
      const R = b.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
      b.userData.sonicBusterReach = R * C.LIBRA_BUSTER_RADIUS_MULT;
    },
    onStep(ctx) {
      const b = ctx.body;
      shared.clearSonicSlow(b);
      b.userData.sonicBusterT = (b.userData.sonicBusterT ?? 0) + ctx.dt;
      b.position.x = 0;
      b.position.z = 0;
      b.velocity.set(0, 0, 0);
      const fullReach = b.userData.sonicBusterReach ?? CONFIG.DEFAULT_OUTER_RADIUS * C.LIBRA_BUSTER_RADIUS_MULT;
      const elapsed = C.effectiveSpecialWindup(C.LIBRA_BUSTER_WINDUP_DUR) + (b.userData.sonicBusterT ?? 0);
      const reach = C.libraBusterSandRadius(fullReach, elapsed);
      b.userData.sonicBusterSpread = reach;
      const pitX = b.position.x;
      const pitZ = b.position.z;

      for (const victim of [ctx.state.playerBody, ctx.state.aiBody]) {
        if (!victim || victim === b) continue;
        const dx = victim.position.x - pitX;
        const dz = victim.position.z - pitZ;
        const dist = Math.hypot(dx, dz);
        if (dist >= reach) {
          shared.clearSonicSlow(victim);
          continue;
        }

        const falloff = 1 - dist / reach;
        const pullFalloff = falloff * falloff;
        if (victim.userData._sonicSlowBaseSteer == null) {
          victim.userData._sonicSlowBaseSteer = victim.userData.steerMult ?? 1;
        }
        victim.userData.sonicSlow = falloff;
        victim.userData.sonicPull = pullFalloff;
        const slowAmt = (1 - C.LIBRA_BUSTER_SLOW_STEER) * falloff * C.LIBRA_BUSTER_SLOW_RATE;
        const slowFactor = Math.max(0.06, 1 - slowAmt);
        victim.userData.steerMult = victim.userData._sonicSlowBaseSteer * slowFactor;
        const drag = 1 - Math.min(
          0.9,
          C.LIBRA_BUSTER_DRAG * C.LIBRA_BUSTER_SLOW_RATE * falloff * ctx.dt
        );
        victim.velocity.x *= drag;
        victim.velocity.z *= drag;

        const sink = C.LIBRA_BUSTER_QUICKSAND_SINK * pullFalloff * ctx.dt;
        victim.velocity.x -= (dx / dist) * sink;
        victim.velocity.z -= (dz / dist) * sink;
      }
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.sonicBuster = false;
      b.userData.sonicBusterWindup = false;
      b.userData.controlLocked = false;
      delete b.userData.sonicBusterT;
      delete b.userData.sonicBusterX;
      delete b.userData.sonicBusterZ;
      delete b.userData.sonicBusterReach;
      delete b.userData.sonicBusterSpread;
      b.userData.flightSquash = 1;
      b.userData.flightTilt = 0;
      b.userData.flightRoll = 0;
      b.userData.flightLift = 0;
      shared.clearLibraSandBoost(b);
      shared.clearLibraBusterVibrate(b);
      shared.clearSonicSlow(ctx.state.playerBody);
      shared.clearSonicSlow(ctx.state.aiBody);
    },
  }
};
