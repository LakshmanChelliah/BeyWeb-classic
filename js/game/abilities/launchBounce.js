/**
 * Shared post-hit launch → bounce → settle cinematic for slam victims.
 * Modeled on Star Blast bounce physics so Bull / Eagle / Striker / L-Drago
 * hits send the foe flying with decaying hops instead of a flat land.
 */
import * as CANNON from 'cannon-es';
import { CONFIG } from '../../config.js';
import { setBodyCollisions } from '../../physics/top.js';
import { clamp01 } from '../../utils/math.js';

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutQuad = (t) => 1 - (1 - t) * (1 - t);

/** Per-move presets: heavier Bull, sharper Eagle, snappy Striker/L-Drago. */
export const LAUNCH_PRESETS = {
  bull: {
    peakLift: 14,
    riseDur: 0.88,
    gravity: 24,
    bounceVelocity: 11,
    restitution: 0.42,
    minV: 3.6,
    bounceGravity: 58,
    pulseDur: 0.2,
    uprightRate: 0.00035,
    settleDur: 1.15,
    settleHops: 3,
    settleHopHeight: 0.28,
    settleWobbles: 3,
    settleWobbleAmp: 0.09,
    driftScale: 0.32,
    driftDur: 2.2,
    landKbScale: 0.2,
    wobbleAmp: 0.2,
    wobbleRate: 7.8,
  },
  eagle: {
    peakLift: 11,
    riseDur: 0.55,
    gravity: 36,
    bounceVelocity: 12,
    restitution: 0.46,
    minV: 3.8,
    bounceGravity: 64,
    pulseDur: 0.18,
    uprightRate: 0.0004,
    settleDur: 1.05,
    settleHops: 3,
    settleHopHeight: 0.26,
    settleWobbles: 2.5,
    settleWobbleAmp: 0.07,
    driftScale: 0.38,
    driftDur: 1.6,
    landKbScale: 0.22,
    wobbleAmp: 0.16,
    wobbleRate: 9.2,
  },
  striker: {
    peakLift: 7.5,
    riseDur: 0.38,
    gravity: 42,
    bounceVelocity: 9.5,
    restitution: 0.4,
    minV: 3.4,
    bounceGravity: 68,
    pulseDur: 0.16,
    uprightRate: 0.0005,
    settleDur: 0.9,
    settleHops: 2,
    settleHopHeight: 0.2,
    settleWobbles: 2,
    settleWobbleAmp: 0.06,
    driftScale: 0.34,
    driftDur: 1.2,
    landKbScale: 0.18,
    wobbleAmp: 0.12,
    wobbleRate: 10.5,
  },
  ldrago: {
    peakLift: 12.5,
    riseDur: 0.58,
    gravity: 34,
    bounceVelocity: 13,
    restitution: 0.48,
    minV: 3.8,
    bounceGravity: 58,
    pulseDur: 0.22,
    uprightRate: 0.00038,
    settleDur: 1.15,
    settleHops: 3,
    settleHopHeight: 0.3,
    settleWobbles: 3,
    settleWobbleAmp: 0.1,
    driftScale: 0.42,
    driftDur: 1.85,
    landKbScale: 0.24,
    wobbleAmp: 0.22,
    wobbleRate: 8.2,
  },
};

function groundY(body) {
  const r = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  return CONFIG.FLOOR_Y + r + CONFIG.FLOOR_EPSILON;
}

function setAirborneKinematic(body) {
  if (body.type !== CANNON.Body.KINEMATIC) {
    body.userData._prevBodyType = body.type;
    body.type = CANNON.Body.KINEMATIC;
  }
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
}

function restoreDynamicBody(body) {
  body.type = body.userData._prevBodyType ?? CANNON.Body.DYNAMIC;
  delete body.userData._prevBodyType;
  body.velocity.set(0, 0, 0);
}

function applyPhysicsKnockback(body, nx, nz, distance) {
  if (!body || distance <= 0) return;
  const speed = distance * 7;
  body.velocity.x += nx * speed;
  body.velocity.z += nz * speed;
}

export function isLaunchBounceActive(body) {
  return body?.userData?.launchBouncePhase != null;
}

export function clearLaunchBounce(body) {
  if (!body) return;
  delete body.userData.launchBouncePhase;
  delete body.userData.launchBouncePhaseT;
  delete body.userData.launchBounceElapsed;
  delete body.userData.launchBounceFalling;
  delete body.userData.launchBounceVY;
  delete body.userData.launchBounceWobbleT;
  delete body.userData.launchBouncePeakLift;
  delete body.userData.launchBounceFromX;
  delete body.userData.launchBounceFromZ;
  delete body.userData.launchBounceNx;
  delete body.userData.launchBounceNz;
  delete body.userData.launchBounceKbMag;
  delete body.userData.launchBouncePreset;
  delete body.userData.launchBouncePulseT;
  delete body.userData.launchBounceBurstT;
  delete body.userData.launchBounceContactSpeed;
  delete body.userData.launchBounceSettleTilt;
  delete body.userData.launchBounceSettleRoll;
  body.userData.airborne = false;
}

/**
 * Start a victim launch cinematic. Spin loss / hit flags stay in the caller.
 * @param {object} victim cannon body
 * @param {number} nx knockback direction X
 * @param {number} nz knockback direction Z
 * @param {number} kbMag horizontal launch magnitude (arena units feel)
 * @param {keyof typeof LAUNCH_PRESETS | object} presetOrId
 * @param {number} [liftScale=1]
 */
export function startLaunchBounce(victim, nx, nz, kbMag, presetOrId = 'eagle', liftScale = 1) {
  if (!victim) return;
  const preset =
    typeof presetOrId === 'string'
      ? LAUNCH_PRESETS[presetOrId] ?? LAUNCH_PRESETS.eagle
      : presetOrId;

  victim.userData.launchBounceFromX = victim.position.x;
  victim.userData.launchBounceFromZ = victim.position.z;
  victim.userData.launchBounceNx = nx;
  victim.userData.launchBounceNz = nz;
  victim.userData.launchBounceKbMag = kbMag;
  victim.userData.launchBouncePreset = preset;
  victim.userData.launchBouncePhase = 'air';
  victim.userData.launchBouncePhaseT = 0;
  victim.userData.launchBounceElapsed = 0;
  delete victim.userData.launchBounceFalling;
  delete victim.userData.launchBounceVY;
  delete victim.userData.launchBounceWobbleT;
  victim.userData.launchBouncePeakLift = (preset.peakLift ?? 10) * liftScale;
  victim.userData.flightTilt = 0;
  victim.userData.flightRoll = 0;
  victim.userData.flightLift = 0;
  victim.userData.flightSquash = 1.04;
  victim.userData.airborne = true;
  victim.userData.controlLocked = true;
  victim.userData.launchBounceBurstT = 1;
  setBodyCollisions(victim, false);
  setAirborneKinematic(victim);
  victim.velocity.set(0, 0, 0);
  victim.angularVelocity.set(0, 0, 0);
}

function releaseLaunchBounceVictim(body, applyKb = true) {
  if (!body) return;
  const preset = body.userData.launchBouncePreset ?? LAUNCH_PRESETS.eagle;
  if (applyKb && (body.userData.launchBounceKbMag ?? 0) > 0) {
    applyPhysicsKnockback(
      body,
      body.userData.launchBounceNx ?? 0,
      body.userData.launchBounceNz ?? 0,
      body.userData.launchBounceKbMag * (preset.landKbScale ?? 0.2)
    );
  }
  body.userData.controlLocked = false;
  body.userData.airborne = false;
  body.userData.flightLift = 0;
  body.userData.flightTilt = 0;
  body.userData.flightRoll = 0;
  body.userData.flightSquash = 1;
  clearLaunchBounce(body);
  setBodyCollisions(body, true);
  if (body.type === CANNON.Body.KINEMATIC) restoreDynamicBody(body);
  body.position.y = groundY(body);
}

function pinLaunchBouncePhysics(body) {
  if (!body?.userData?.launchBouncePhase) return;
  if (body.type !== CANNON.Body.KINEMATIC) setAirborneKinematic(body);
  const phase = body.userData.launchBouncePhase;
  // Collide again once bouncing so hops feel grounded.
  setBodyCollisions(body, phase === 'bounce' || phase === 'settle');
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.position.y = groundY(body);
}

/**
 * Advance launch/bounce/settle for one body. Call once per render/physics tick.
 */
export function tickLaunchBounce(body, dt) {
  if (body.userData.launchBounceBurstT != null) {
    body.userData.launchBounceBurstT -= dt * 5;
    if (body.userData.launchBounceBurstT <= 0) delete body.userData.launchBounceBurstT;
  }

  if (!body.userData.launchBouncePhase) return;

  const preset = body.userData.launchBouncePreset ?? LAUNCH_PRESETS.eagle;
  pinLaunchBouncePhysics(body);
  body.userData.airborne = true;
  body.userData.controlLocked = true;
  body.userData.launchBounceElapsed = (body.userData.launchBounceElapsed ?? 0) + dt;
  body.userData.launchBouncePhaseT = (body.userData.launchBouncePhaseT ?? 0) + dt;

  const peakLift = body.userData.launchBouncePeakLift ?? preset.peakLift;
  const phase = body.userData.launchBouncePhase;

  // Horizontal drift during air / early bounce.
  const kb = body.userData.launchBounceKbMag ?? 0;
  if (kb > 0 && (phase === 'air' || phase === 'bounce')) {
    const p = easeOutQuad(clamp01(body.userData.launchBounceElapsed / (preset.driftDur ?? 1.6)));
    const fromX = body.userData.launchBounceFromX ?? body.position.x;
    const fromZ = body.userData.launchBounceFromZ ?? body.position.z;
    const dist = kb * (preset.driftScale ?? 0.32);
    body.position.x = fromX + (body.userData.launchBounceNx ?? 0) * dist * p;
    body.position.z = fromZ + (body.userData.launchBounceNz ?? 0) * dist * p;
  }

  if (phase === 'air') {
    if (!body.userData.launchBounceFalling) {
      const t = clamp01(body.userData.launchBouncePhaseT / (preset.riseDur ?? 0.55));
      const e = easeOutCubic(t);
      body.userData.flightLift = peakLift * Math.sin(e * Math.PI * 0.5);
      if (t >= 1) {
        body.userData.launchBounceFalling = true;
        body.userData.launchBounceVY = 0;
      }
    } else {
      let vy = body.userData.launchBounceVY ?? 0;
      vy -= (preset.gravity ?? 36) * dt;
      let lift = (body.userData.flightLift ?? 0) + vy * dt;
      if (lift <= 0) {
        // Transition into bounce hops.
        body.userData.flightLift = 0;
        body.userData.launchBounceVY = preset.bounceVelocity ?? 10;
        body.userData.launchBouncePulseT = 0;
        body.userData.launchBounceContactSpeed = preset.bounceVelocity ?? 10;
        body.userData.launchBouncePhase = 'bounce';
        body.userData.launchBouncePhaseT = 0;
        body.userData.launchBounceBurstT = 1;
        return;
      }
      body.userData.launchBounceVY = vy;
      body.userData.flightLift = lift;
    }

    const lift = body.userData.flightLift ?? 0;
    const airFrac = clamp01(lift / Math.max(peakLift * 0.22, 0.5));
    const wobbleT = (body.userData.launchBounceWobbleT ?? 0) + dt;
    body.userData.launchBounceWobbleT = wobbleT;
    const amp = (preset.wobbleAmp ?? 0.16) * airFrac;
    const rate = preset.wobbleRate ?? 8;
    body.userData.flightTilt = amp * Math.sin(wobbleT * rate);
    body.userData.flightRoll = amp * Math.sin(wobbleT * rate * 0.83 + 0.6);
    body.userData.flightSquash = 1 + 0.03 * airFrac * Math.sin(wobbleT * rate * 1.6);
    return;
  }

  if (phase === 'bounce') {
    let vy = body.userData.launchBounceVY ?? 0;
    vy -= (preset.bounceGravity ?? 62) * dt;
    let lift = (body.userData.flightLift ?? 0) + vy * dt;
    body.userData.launchBouncePulseT = (body.userData.launchBouncePulseT ?? 0) + dt;

    if (lift <= 0) {
      lift = 0;
      const contactSpeed = Math.abs(vy);
      body.userData.launchBounceContactSpeed = contactSpeed;
      if (contactSpeed < (preset.minV ?? 3.5)) {
        body.userData.flightLift = 0;
        body.userData.launchBounceSettleTilt = body.userData.flightTilt ?? 0;
        body.userData.launchBounceSettleRoll = body.userData.flightRoll ?? 0;
        body.userData.launchBouncePhase = 'settle';
        body.userData.launchBouncePhaseT = 0;
        return;
      }
      vy = contactSpeed * (preset.restitution ?? 0.44);
      body.userData.launchBouncePulseT = 0;
      body.userData.launchBounceBurstT = Math.min(1, contactSpeed / (preset.bounceVelocity ?? 10));
      body.userData.flightTilt = (body.userData.flightTilt ?? 0) * 0.45;
      body.userData.flightRoll = (body.userData.flightRoll ?? 0) * 0.45;
    }

    body.userData.launchBounceVY = vy;
    body.userData.flightLift = lift;

    const pulse = clamp01(
      (body.userData.launchBouncePulseT ?? 0) / (preset.pulseDur ?? 0.2)
    );
    const stretch =
      0.12 *
      Math.sin(pulse * Math.PI) *
      clamp01(Math.abs(vy) / (preset.bounceVelocity ?? 10));
    body.userData.flightSquash = 1 - 0.4 * (1 - pulse) + stretch;

    const rightRate = 1 - Math.pow(preset.uprightRate ?? 0.00035, dt);
    body.userData.flightTilt *= 1 - rightRate;
    body.userData.flightRoll *= 1 - rightRate;
    return;
  }

  if (phase === 'settle') {
    const t = clamp01(body.userData.launchBouncePhaseT / (preset.settleDur ?? 1));
    const decay = (1 - t) * (1 - t);
    const hops =
      Math.abs(Math.sin(t * Math.PI * (preset.settleHops ?? 3))) *
      (preset.settleHopHeight ?? 0.24) *
      decay;
    body.userData.flightLift = hops;

    const sway =
      Math.sin(t * Math.PI * (preset.settleWobbles ?? 2.5)) *
      (preset.settleWobbleAmp ?? 0.07) *
      decay;
    const settleEase = 1 - easeOutCubic(t);
    body.userData.flightTilt =
      (body.userData.launchBounceSettleTilt ?? 0) * settleEase + sway;
    body.userData.flightRoll =
      (body.userData.launchBounceSettleRoll ?? 0) * settleEase;

    const grounded = 1 - clamp01(hops / ((preset.settleHopHeight ?? 0.24) * 0.35));
    body.userData.flightSquash = 1 - 0.1 * grounded * decay;

    if (t >= 1) {
      releaseLaunchBounceVictim(body, true);
    }
  }
}

/** Tick both tops if present. */
export function tickLaunchBounceBodies(state, dt) {
  if (state.playerBody) tickLaunchBounce(state.playerBody, dt);
  if (state.aiBody) tickLaunchBounce(state.aiBody, dt);
}
