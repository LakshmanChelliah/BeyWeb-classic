import * as CANNON from 'cannon-es';
import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { isAtPocketAngle } from '../../../physics/arena.js';
import { clamp01 } from '../../../utils/math.js';
import * as C from '../constants.js';
import * as shared from '../shared.js';

export const bullAbilities = {
  bull_maximum_stampede: {
    id: 'bull_maximum_stampede',
    name: 'Maximum Stampede',
    slot: 'power',
    icon: '\u25C8',
    desc: 'Charges through rivals for a modest knockback boost on contact.',
    charge: 6.5,
    cooldown: 9,
    duration: C.BULL_STAMPEDE_DURATION,
    windup: 0,
    glow: '#ef4444',
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.stampeding = true;
      b.userData.stampedeT = 0;
      b.userData.steerMult = C.BULL_STAMPEDE_STEER;
      b.userData.prevDamping = b.linearDamping;
      b.linearDamping = Math.max(0.05, b.linearDamping * 0.65);
    },
    onStep(ctx) {
      const b = ctx.body;
      if (!b.userData.stampeding) return;
      const vx = b.velocity.x;
      const vz = b.velocity.z;
      const len = Math.hypot(vx, vz);
      if (len > 0.5) {
        const bias = 1.35 * ctx.dt;
        b.velocity.x += (vx / len) * bias;
        b.velocity.z += (vz / len) * bias;
      }
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.stampeding = false;
      b.userData.steerMult = 1;
      delete b.userData.stampedeT;
      if (b.userData.prevDamping != null) b.linearDamping = b.userData.prevDamping;
      b.userData.flightSquash = 1;
      b.userData.flightTilt = 0;
    },
  },

  bull_red_horn_uppercut: {
    id: 'bull_red_horn_uppercut',
    name: 'Red Horn Uppercut',
    slot: 'special',
    icon: '\u25B2',
    desc: 'Lower horns, then charge. Launches foes outward; strongest near the rim.',
    charge: 10,
    cooldown: 12,
    duration: C.BULL_UPPERCUT_DURATION,
    windup: C.BULL_UPPERCUT_WINDUP,
    glow: '#dc2626',
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.airborne = true;
      b.userData.controlLocked = true;
      b.userData.bullUpperPhase = 'dash';
      b.userData.bullUpperPhaseT = 0;
      b.userData.bullUpperHit = false;
      b.userData.bullImpactFlash = false;
      delete b.userData.bullImpactResolved;
      delete b.userData.bullDashDone;
      b.userData.bullChargeFromX = b.position.x;
      b.userData.bullChargeFromZ = b.position.z;
      shared.initBullDashTarget(b, ctx.opponentBody);
      shared.setAirborneKinematic(b);
      setBodyCollisions(b, false);
    },
    onEnd(ctx) {
      shared.releaseBullUppercutControl(ctx.body);
    },
  }
};
