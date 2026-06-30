import * as CANNON from 'cannon-es';
import { CONFIG } from '../../../config.js';
import { setBodyCollisions } from '../../../physics/top.js';
import { isAtPocketAngle } from '../../../physics/arena.js';
import { clamp01 } from '../../../utils/math.js';
import * as C from '../constants.js';
import * as shared from '../shared.js';

export const ldragoAbilities = {
  ldrago_absorb_break: {
    id: 'ldrago_absorb_break',
    name: 'Dragon Emperor: Absorb Break',
    slot: 'special',
    icon: '\u2620',
    desc: 'Coils and rushes the rival — devours a huge chunk of spin and knocks them back on connect.',
    charge: 11,
    cooldown: 13,
    duration: C.LDRAGO_ABSORB_DURATION,
    windup: C.LDRAGO_ABSORB_WINDUP,
    glow: C.METEO_GLOW,
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.airborne = true;
      b.userData.controlLocked = true;
      b.userData.invulnerable = true;
      b.userData.ldragoAbsorbPhase = 'rush';
      b.userData.ldragoAbsorbPhaseT = 0;
      delete b.userData.ldragoAbsorbHit;
      delete b.userData.ldragoAbsorbDashDone;
      delete b.userData.ldragoAbsorbWindup;
      b.userData.ldragoAbsorbFromX = b.position.x;
      b.userData.ldragoAbsorbFromZ = b.position.z;
      shared.initLdragoAbsorbTarget(b, ctx.opponentBody);
      shared.setAirborneKinematic(b);
      setBodyCollisions(b, false);
    },
    onEnd(ctx) {
      shared.releaseLdragoAbsorbControl(ctx.body);
    },
  },

  ldrago_soaring_destruction: {
    id: 'ldrago_soaring_destruction',
    name: 'Dragon Emperor, Soaring Destruction',
    slot: 'special',
    icon: '\u2726',
    desc: 'Ryuga\'s soaring lightning assault — foes struck take Star Blast-level knockback and spin loss.',
    charge: 12,
    cooldown: 14,
    duration: 3.05,
    windup: 0.65,
    glow: C.LDRAGO_GLOW,
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.airborne = true;
      b.userData.guarding = true;
      b.userData.invulnerable = true;
      b.userData.controlLocked = true;
      b.userData.ldragoFlightWindup = false;
      b.userData.ldragoFlightT = 0;
      b.userData.ldragoFlightLaunchT = 1;
      b.userData.guardX = b.position.x;
      b.userData.guardZ = b.position.z;
      shared.setAirborneKinematic(b);
    },
    onStep(ctx) {
      const b = ctx.body;
      b.userData.ldragoFlightT = (b.userData.ldragoFlightT ?? 0) + ctx.dt;
      shared.tickLdragoSupremeFlightLightning(ctx.state, b, ctx.dt);
      b.position.y = C.groundY(b);
      const xzLerp = 1 - Math.exp(-12 * ctx.dt);
      b.position.x += ((b.userData.guardX ?? b.position.x) - b.position.x) * xzLerp;
      b.position.z += ((b.userData.guardZ ?? b.position.z) - b.position.z) * xzLerp;
      b.velocity.set(0, 0, 0);
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.airborne = false;
      b.userData.guarding = false;
      b.userData.invulnerable = false;
      b.userData.controlLocked = false;
      b.userData.ldragoFlightWindup = false;
      b.userData.flightLift = 0;
      b.userData.flightTilt = 0;
      b.userData.flightRoll = 0;
      b.userData.flightSquash = 1;
      delete b.userData.ldragoFlightT;
      delete b.userData.ldragoFlightLaunchT;
      delete b.userData.flightRepulseT;
      delete b.userData.ldragoLightningSpots;
      delete b.userData.ldragoLightningFired;
      delete b.userData.ldragoLightningCharging;
      delete b.userData.ldragoFlightRerising;
      b.position.y = C.groundY(b);
      shared.restoreDynamicBody(b);
    },
  },

  ldrago_spin_steal: {
    id: 'ldrago_spin_steal',
    name: 'Spin Steal',
    slot: 'power',
    icon: '\u21BB',
    desc: 'While active, steal opponent spin on every clash, take no spin loss, and cut collision knockback by 60%.',
    charge: 7.5,
    cooldown: 10,
    duration: 4,
    windup: 0,
    glow: C.METEO_GLOW,
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.spinStealing = true;
      b.userData.spinStealT = 0;
    },
    onEnd(ctx) {
      const b = ctx.body;
      b.userData.spinStealing = false;
      delete b.userData.spinStealT;
      delete b.userData.spinStealBurstT;
      delete b.userData.spinStealFromX;
      delete b.userData.spinStealFromZ;
    },
  },

  // Lightning L-Drago power: rotate L-Drago I to Upper Mode for a Smash Attack
  // knockback burst (wiki fusion-wheel mode-change gimmick).

  ldrago_upper_mode: {
    id: 'ldrago_upper_mode',
    name: 'Upper Mode',
    slot: 'power',
    icon: '\u25B2',
    desc: 'Rotates L-Drago I to Upper Attack — outgoing collision knockback boosted 50% for 3.5s.',
    charge: 7.5,
    cooldown: 10,
    duration: C.LDRAGO_UPPER_MODE_DUR,
    windup: 0,
    glow: C.LDRAGO_GLOW,
    onActivate(ctx) {
      const b = ctx.body;
      b.userData.atkCombatMultMult = C.LDRAGO_UPPER_MODE_KB_MULT;
      b.userData.ldragoUpperMode = true;
    },
    onEnd(ctx) {
      const b = ctx.body;
      delete b.userData.atkCombatMultMult;
      delete b.userData.ldragoUpperMode;
    },
  }
};
