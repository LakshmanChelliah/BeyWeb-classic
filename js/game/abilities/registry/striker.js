import * as CANNON from 'cannon-es';
import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { isAtPocketAngle } from '../../../physics/arena.js';
import { clamp01 } from '../../../utils/math.js';
import * as C from '../constants.js';
import * as shared from '../shared.js';

export const strikerAbilities = {
  striker_blitz_charge: {
    id: 'striker_blitz_charge',
    name: 'Blitz Charge',
    slot: 'power',
    icon: '\u00BB',
    desc: 'CS tip digs in for a sharp burst of speed and steering.',
    charge: 5,
    cooldown: 8,
    duration: 3,
    windup: 0,
    glow: C.STRIKER_GLOW,
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.steerMult = C.STRIKER_BLITZ_STEER;
      b.userData.boosting = true;
      b.userData.boostT = 0;
      b.userData.prevDamping = b.linearDamping;
      b.linearDamping = Math.max(0.05, b.linearDamping * 0.48);
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.steerMult = 1;
      b.userData.boosting = false;
      delete b.userData.boostT;
      if (b.userData.prevDamping != null) b.linearDamping = b.userData.prevDamping;
    },
  },

  striker_lightning_flash: {
    id: 'striker_lightning_flash',
    name: 'Lightning Sword Flash',
    slot: 'special',
    icon: '\u26A1',
    desc: 'Vanishes in a teal flash, reappears on the rival, and pierces through — whiffs cost a little spin.',
    charge: 10,
    cooldown: 11,
    duration: C.STRIKER_FLASH_DURATION,
    windup: C.STRIKER_FLASH_WINDUP,
    glow: C.STRIKER_GLOW,
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.airborne = true;
      b.userData.controlLocked = true;
      b.userData.invulnerable = true;
      b.userData.strikerFlashPhase = 'vanish';
      b.userData.strikerFlashPhaseT = 0;
      b.userData.topVanish = 0;
      delete b.userData.strikerFlashHit;
      delete b.userData.strikerDashDone;
      delete b.userData.strikerReappearFlash;
      b.userData.strikerVanishX = b.position.x;
      b.userData.strikerVanishZ = b.position.z;
      b.userData.strikerChargeFromX = b.position.x;
      b.userData.strikerChargeFromZ = b.position.z;
      delete b.userData.strikerCoastTargetX;
      delete b.userData.strikerCoastTargetZ;
      shared.setAirborneKinematic(b);
      setBodyCollisions(b, false);
    },
    onEnd(ctx) {
      shared.releaseStrikerFlashControl(ctx.body);
    },
  }
};
