import * as CANNON from 'cannon-es';
import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { isAtPocketAngle } from '../../../physics/arena.js';
import { clamp01 } from '../../../utils/math.js';
import * as C from '../constants.js';
import * as shared from '../shared.js';

export const leoneAbilities = {
  leone_wide_ball: {
    id: 'leone_wide_ball',
    name: 'Wide Ball Anchor',
    slot: 'power',
    icon: '\u25C9',
    desc: 'WB tip digs in — takes only 20% collision knockback and no spin loss from hits.',
    charge: 6,
    cooldown: 9,
    duration: 2.6,
    windup: 0,
    glow: '#4ade80',
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.anchoring = true;
      b.userData.steerMult = C.LEONE_ANCHOR_STEER;
      b.userData.prevDamping = b.linearDamping;
      b.linearDamping = C.LEONE_ANCHOR_DAMPING;
      b.userData.leoneAnchorT = 0;
    },
    onStep(ctx) {
      const b = ctx.body;
      // Cap drift so planted grip still reads, but 20% knockback can show through.
      const speed = Math.hypot(b.velocity.x, b.velocity.z);
      const maxSpeed = 4.2 * C.LEONE_ANCHOR_DAMAGE_TAKEN;
      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        b.velocity.x *= scale;
        b.velocity.z *= scale;
      }
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.anchoring = false;
      b.userData.steerMult = 1;
      if (b.userData.prevDamping != null) b.linearDamping = b.userData.prevDamping;
      b.userData.flightSquash = 1;
      b.userData.flightTilt = 0;
      b.userData.flightRoll = 0;
      delete b.userData.leoneAnchorT;
    },
  },

  leone_lion_wall: {
    id: 'leone_lion_wall',
    name: 'Lion Gale Force Wall',
    slot: 'special',
    icon: '\u25CE',
    desc: 'Spins up a green tornado wall that repels rivals and shrugs off spin loss; costs a little stamina.',
    charge: 9,
    cooldown: 12,
    duration: C.LEONE_WALL_DURATION,
    windup: 0.45,
    glow: '#22c55e',
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.guarding = true;
      b.userData.lionWall = true;
      b.userData.lionWallWindup = false;
      b.userData.airborne = true;
      b.userData.lionWallPulse = 0;
      b.userData.lionWallT = 0;
      b.userData.lionWallReach =
        (b.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS) * C.LEONE_WALL_REACH_MULT;
      b.userData.controlLocked = true;
      b.userData.prevDamping = b.linearDamping;
      b.linearDamping = Math.max(0.38, b.linearDamping * 1.35);
    },
    onStep(ctx) {
      const b = ctx.body;
      const opp = ctx.opponentBody;
      b.userData.lionWallPulse = (b.userData.lionWallPulse ?? 0) + ctx.dt;
      ctx.addSpin(-C.LEONE_WALL_SELF_SPIN * ctx.dt, ctx.side);

      if (!opp) return;

      const rA = b.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
      const rB = opp.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
      const dx = opp.position.x - b.position.x;
      const dz = opp.position.z - b.position.z;
      const dist = Math.hypot(dx, dz) || 1;
      const reach = (rA + rB) * C.LEONE_WALL_REACH_MULT;
      b.userData.lionWallReach = reach;
      if (dist >= reach) return;

      const nx = dx / dist;
      const nz = dz / dist;
      const falloff = 1 - dist / reach;

      // Continuous gale push — ground beys are shoved even though vertical contact is blocked.
      const push = C.LEONE_WALL_REPULSE * falloff * (ctx.dt / C.LEONE_WALL_PULSE);
      opp.velocity.x += nx * push;
      opp.velocity.z += nz * push;

      // Positional separation under the hover disc (replaces contact overlap correction).
      const minDist = rA + rB;
      if (dist < minDist) {
        const overlap = minDist - dist;
        opp.position.x += nx * overlap;
        opp.position.z += nz * overlap;
      }

      if (b.userData.lionWallPulse < C.LEONE_WALL_PULSE) return;
      b.userData.lionWallPulse = 0;

      if (falloff > 0.25) {
        ctx.addSpin(-C.LEONE_WALL_REPULSE_SPIN * falloff, ctx.oppSide);
        b.userData.lionWallBurstT = falloff;
      }
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.guarding = false;
      b.userData.lionWall = false;
      b.userData.lionWallWindup = false;
      b.userData.controlLocked = false;
      delete b.userData.lionWallPulse;
      delete b.userData.lionWallT;
      delete b.userData.lionWallBurstT;
      delete b.userData.lionWallReach;
      b.userData.flightSquash = 1;
      b.userData.flightTilt = 0;
      b.userData.flightRoll = 0;
      b.userData.flightLift = 0;
      b.userData.airborne = false;
      delete b.userData.contactLift;
      if (b.userData.prevDamping != null) b.linearDamping = b.userData.prevDamping;
    },
  }
};
