import * as CANNON from 'cannon-es';
import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { isAtPocketAngle } from '../../../physics/arena.js';
import { clamp01 } from '../../../utils/math.js';
import * as C from '../constants.js';
import * as shared from '../shared.js';

export const pegasusAbilities = {
  pegasus_speed_boost: {
    id: 'pegasus_speed_boost',
    name: 'Speed Boost',
    slot: 'power',
    icon: '»',
    desc: 'Temporary burst of speed and grip.',
    charge: 5,
    cooldown: 8,
    duration: 3,
    windup: 0,
    glow: '#60a5fa',
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.steerMult = C.BOOST_STEER_MULT;
      b.userData.boosting = true;
      b.userData.boostT = 0;
      b.userData.prevDamping = b.linearDamping;
      b.linearDamping = Math.max(0.05, b.linearDamping * 0.5);
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.steerMult = 1;
      b.userData.boosting = false;
      delete b.userData.boostT;
      if (b.userData.prevDamping != null) b.linearDamping = b.userData.prevDamping;
    },
  },

  pegasus_star_blast: {
    id: 'pegasus_star_blast',
    name: 'Star Blast Attack',
    slot: 'special',
    icon: '\u2605',
    desc: 'Slams the wall, dives on the foe for heavy spin damage; whiffs cost ~5% spin.',
    charge: 11,
    cooldown: 12,
    duration: 6,
    windup: 0.5,
    glow: '#60a5fa',
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.airborne = true;
      b.userData.controlLocked = true;
      b.userData.slamming = false;
      b.userData.flightTilt = 0;
      b.userData.flightRoll = 0;
      delete b.userData.starBlastWindup;
      b.userData.starPhase = 'dash';
      b.userData.starPhaseT = 0;
      shared.setAirborneKinematic(b);
      setBodyCollisions(b, false);
    },
    onEnd(ctx) {
      shared.releaseStarBlastControl(ctx.body);
    },
  }
};
