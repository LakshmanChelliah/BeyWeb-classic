import * as CANNON from 'cannon-es';
import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { isAtPocketAngle } from '../../../physics/arena.js';
import { clamp01 } from '../../../utils/math.js';
import * as C from '../constants.js';
import * as shared from '../shared.js';

export const eagleAbilities = {
  eagle_counter_stance: {
    id: 'eagle_counter_stance',
    name: 'Counter Stance',
    slot: 'power',
    icon: 'C',
    desc: 'Eagle braces and counters the foe\'s next move with reflected knockback and spin damage.',
    charge: 6,
    cooldown: 9,
    duration: C.EAGLE_COUNTER_DUR,
    windup: 0,
    glow: C.EAGLE_GLOW,
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.counterStance = true;
      b.userData.eagleCounterT = 0;
      b.userData.eagleCounterFlashT = 0;
      b.userData.eagleCounterFromX = null;
      b.userData.eagleCounterFromZ = null;
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.counterStance = false;
      delete b.userData.eagleCounterT;
      delete b.userData.eagleCounterFlashT;
      delete b.userData.eagleCounterFromX;
      delete b.userData.eagleCounterFromZ;
    },
  },

  eagle_diving_crush: {
    id: 'eagle_diving_crush',
    name: 'Diving Crush',
    slot: 'special',
    icon: 'V',
    desc: 'Eagle rises above the stadium, then crushes its opponent with a talon-first diving smash.',
    charge: 11,
    cooldown: 13,
    duration: 3.1,
    windup: 0.55,
    glow: C.EAGLE_GLOW,
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.airborne = true;
      b.userData.invulnerable = true;
      b.userData.controlLocked = true;
      b.userData.slamming = false;
      b.userData.eagleDiveWindup = false;
      b.userData.eagleDivePhase = 'ascend';
      b.userData.eagleDivePhaseT = 0;
      b.userData.eagleDiveHit = false;
      delete b.userData.eagleDiveResolved;
      delete b.userData.eagleDiveTargetX;
      delete b.userData.eagleDiveTargetZ;
      shared.setAirborneKinematic(b);
      setBodyCollisions(b, false);
    },
    onEnd(ctx) {
      shared.releaseEagleDiveControl(ctx.body);
    },
  }
};
