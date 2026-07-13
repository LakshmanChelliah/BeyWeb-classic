import * as CANNON from 'cannon-es';
import { CONFIG } from '../config.js';
import { isAtPocketAngle, wallClampRadius } from './arena.js';
import { clamp01 } from '../utils/math.js';

const WALL_CLIP_POCKET_TOLERANCE = 1;
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** Attack sources that read as upper / aerial — easier to vault the rim. */
const UPPER_EXIT_SOURCES = new Set(['bull', 'ldrago', 'eagle', 'pegasus', 'striker']);

function setBodyCollisions(body, enabled) {
  if (!body) return;
  const on = !!enabled;
  if (!!body.userData.collisionsDisabled === !on) return;
  body.userData.collisionsDisabled = !on;
  body.collisionFilterMask = on ? CONFIG.COLLISION_BOWL : 0;
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
}

function groundY(body) {
  const r = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  return CONFIG.FLOOR_Y + r + CONFIG.FLOOR_EPSILON;
}

/** Visual height used for rim clearance (flightLift dominates cinematic lifts). */
export function effectiveFlightHeight(body) {
  if (!body) return 0;
  return Math.max(0, body.userData.flightLift ?? 0);
}

/**
 * Clearance bar scales with attack type: upper launches and big knockbacks
 * clear the rim more easily than shallow horizontal shoves.
 */
export function wallClearLiftFor(body) {
  let need = CONFIG.WALL_CLEAR_LIFT;
  const source =
    body.userData.launchBounceSource ??
    body.userData.stadiumExitSource ??
    null;

  if (source && UPPER_EXIT_SOURCES.has(source)) need *= 0.82;
  if (body.userData.bullUpperSlamming || body.userData.eagleDiveSlamming) need *= 0.78;
  if (body.userData.starPhase != null || body.userData.ldragoPhase != null) need *= 0.88;

  const kb = body.userData.launchBounceKbMag ?? 0;
  if (kb >= 10) need *= 0.9;
  else if (kb >= 6) need *= 0.95;

  const peak = body.userData.launchBouncePeakLift ?? 0;
  if (peak >= 12) need *= 0.88;
  else if (peak >= 9) need *= 0.93;

  return need;
}

export function outwardRadialSpeed(body, nx, nz) {
  if (!body) return 0;
  return body.velocity.x * nx + body.velocity.z * nz;
}

/** True when height (and optional outward push) is enough to vault the rim. */
export function canClearStadiumWall(body, outwardSpeed = 0) {
  if (!body) return false;
  if (body.userData.stadiumFlyOut) return true;

  const lift = effectiveFlightHeight(body);
  const need = wallClearLiftFor(body);
  if (lift >= need) return true;

  // Near the lip with hard outward momentum — vault over instead of clipping through.
  if (lift >= need * 0.7 && outwardSpeed >= CONFIG.WALL_CLEAR_OUT_SPEED) return true;

  // Extreme grounded shove (rare; special knockback spikes).
  if (lift < 0.35 && outwardSpeed >= CONFIG.WALL_VAULT_SPEED) return true;

  return false;
}

function shouldSkipWallResolve(body) {
  if (!body) return true;
  if (body.userData.ringOut) return true;
  if (body.userData.launching) return true;
  if (body.userData.stadiumFlyOut) return true;
  // Intentional wall-climb / rim specials stay authored — don't shove them off.
  const star = body.userData.starPhase;
  if (star === 'dash' || star === 'wallImpact' || star === 'ascend' || star === 'apex') {
    return true;
  }
  const ldrago = body.userData.ldragoPhase;
  if (ldrago === 'dash' || ldrago === 'wallImpact' || ldrago === 'ascend' || ldrago === 'apex') {
    return true;
  }
  return false;
}

/**
 * Kick off an over-the-wall fly-out. Leaves the play bowl; KO registers once
 * past FLY_OUT_KO_RADIUS (or platform edge via existing rules).
 */
export function beginStadiumFlyOut(body, nx, nz, strength = 1) {
  if (!body || body.userData.stadiumFlyOut || body.userData.ringOut) return;

  const nLen = Math.hypot(nx, nz) || 1;
  const ox = nx / nLen;
  const oz = nz / nLen;
  const power = clamp01(strength);

  body.userData.stadiumFlyOut = true;
  body.userData.stadiumFlyOutT = 0;
  body.userData.stadiumFlyOutNx = ox;
  body.userData.stadiumFlyOutNz = oz;
  body.userData.stadiumFlyOutStrength = power;
  body.userData.stadiumFlyOutVY =
    CONFIG.FLY_OUT_UP_BOOST * (0.85 + 0.4 * power) +
    Math.max(0, (body.userData.flightLift ?? 0) * 0.15);
  body.userData.stadiumFlyOutSpeed =
    CONFIG.FLY_OUT_OUT_SPEED * (0.72 + 0.45 * power);
  body.userData.stadiumFlyOutSpin = CONFIG.FLY_OUT_SPIN_RATE * (0.8 + 0.5 * power);
  body.userData.stadiumFlyOutWobbleT = 0;

  // Hand off from launch-bounce cinematic if active.
  delete body.userData.launchBouncePhase;
  delete body.userData.launchBouncePhaseT;
  delete body.userData.launchBounceFalling;
  delete body.userData.launchBounceVY;

  body.userData.controlLocked = true;
  body.userData.airborne = true;
  body.userData.flightLift = Math.max(
    body.userData.flightLift ?? 0,
    CONFIG.WALL_CLEAR_LIFT * 1.05 + power * 1.8
  );
  body.userData.flightSquash = 1.12;
  body.userData.flightTilt = 0.35 + power * 0.25;
  body.userData.flightRoll = (Math.random() > 0.5 ? 1 : -1) * (0.4 + power * 0.35);

  setBodyCollisions(body, false);
  setAirborneKinematic(body);

  // Nudge just past the clamp so we don't immediately re-trigger ricochet.
  const dist = Math.hypot(body.position.x, body.position.z) || 1;
  const maxR = wallClampRadius(body);
  if (dist < maxR + 0.08) {
    const push = maxR + 0.12;
    body.position.x = ox * push;
    body.position.z = oz * push;
    body.previousPosition.x = body.position.x;
    body.previousPosition.z = body.position.z;
  }
}

/**
 * Slam into the rim and bounce back into the bowl — squash, tumble, reverse drift.
 */
export function applyWallRicochet(body, nx, nz, impactSpeed, emitWallImpact) {
  if (!body || body.userData.ringOut || body.userData.stadiumFlyOut) return;

  const nLen = Math.hypot(nx, nz) || 1;
  const ox = nx / nLen;
  const oz = nz / nLen;
  const maxR = wallClampRadius(body);
  const dist = Math.hypot(body.position.x, body.position.z) || 1;

  // Snap inside the solid rim.
  if (dist > maxR) {
    const scale = maxR / dist;
    body.position.x *= scale;
    body.position.z *= scale;
    body.previousPosition.x = body.position.x;
    body.previousPosition.z = body.position.z;
  }

  const speed = Math.max(impactSpeed, Math.hypot(body.velocity.x, body.velocity.z));
  const power = clamp01(speed / CONFIG.WALL_IMPACT_HARD);

  // Reflect horizontal velocity elastically.
  const vOut = body.velocity.x * ox + body.velocity.z * oz;
  if (vOut > 0) {
    const e = CONFIG.WALL_BOUNCE_RESTITUTION;
    body.velocity.x -= (1 + e) * vOut * ox;
    body.velocity.z -= (1 + e) * vOut * oz;
  } else if (speed > 0.4) {
    // Still shove inward a bit so the bounce reads.
    const kick = Math.max(3.5, speed * 0.55);
    body.velocity.x -= ox * kick;
    body.velocity.z -= oz * kick;
  }

  // Reverse / restart launch-bounce drift so airborne victims stay in the bowl.
  if (body.userData.launchBouncePhase) {
    const preset = body.userData.launchBouncePreset ?? {};
    const driftScale = preset.driftScale ?? 0.32;
    const driftDur = preset.driftDur ?? 1.6;
    const kb = body.userData.launchBounceKbMag ?? 0;
    const elapsed = body.userData.launchBounceElapsed ?? 0;
    const p = clamp01(elapsed / driftDur);
    const easeP = 1 - (1 - p) * (1 - p);
    const totalDist = kb * driftScale;
    const remaining = Math.max(0, totalDist * (1 - easeP)) * CONFIG.WALL_RICOCHET_ENERGY;

    body.userData.launchBounceNx = -ox;
    body.userData.launchBounceNz = -oz;
    body.userData.launchBounceFromX = body.position.x;
    body.userData.launchBounceFromZ = body.position.z;
    body.userData.launchBounceKbMag = remaining / Math.max(0.05, driftScale);
    body.userData.launchBounceElapsed = 0;
    body.userData.flightLift = (body.userData.flightLift ?? 0) * 0.82;
  }

  body.userData.wallRicochetT = CONFIG.WALL_RICOCHET_DUR;
  body.userData.wallRicochetPower = power;
  body.userData.wallRicochetNx = ox;
  body.userData.wallRicochetNz = oz;
  body.userData.flightSquash = 0.52 - power * 0.08;
  body.userData.flightTilt = (body.userData.flightTilt ?? 0) * 0.3 + (0.55 + power * 0.45);
  body.userData.flightRoll =
    (body.userData.flightRoll ?? 0) * 0.25 +
    (Math.random() > 0.5 ? 1 : -1) * (0.5 + power * 0.55);

  emitWallImpact?.(body, Math.max(speed, 6), ox, oz);
}

/**
 * Per-step stadium rim resolve: fly over when attack clears the wall, else stay in.
 * Returns 'flyOut' | 'ricochet' | null.
 */
export function resolveStadiumWallBody(body, emitWallImpact) {
  if (shouldSkipWallResolve(body)) return null;

  const x = body.position.x;
  const z = body.position.z;
  const dist = Math.hypot(x, z);
  if (dist <= 0.001) return null;

  if (isAtPocketAngle(Math.atan2(z, x), WALL_CLIP_POCKET_TOLERANCE)) {
    return null;
  }

  const maxR = wallClampRadius(body);
  const nx = x / dist;
  const nz = z / dist;
  const predDist = Math.hypot(
    x + body.velocity.x * CONFIG.FIXED_DT,
    z + body.velocity.z * CONFIG.FIXED_DT
  );
  const vOut = outwardRadialSpeed(body, nx, nz);

  // Launch-bounce drift can outrun velocity (kinematic) — treat remaining push as outward.
  let driftOut = 0;
  if (body.userData.launchBouncePhase === 'air' || body.userData.launchBouncePhase === 'bounce') {
    const kb = body.userData.launchBounceKbMag ?? 0;
    const lnx = body.userData.launchBounceNx ?? 0;
    const lnz = body.userData.launchBounceNz ?? 0;
    driftOut = Math.max(0, kb * (lnx * nx + lnz * nz));
  }

  const outward = Math.max(vOut, driftOut * 2.2);
  const past = dist > maxR;
  const willCross = !past && predDist > maxR && outward > 0.15;

  if (!past && !willCross) {
    // Soft scrape near the rim — elastic bounce for hard impacts only.
    if (dist >= maxR - 0.1 && vOut > CONFIG.WALL_BOUNCE_SPEED && !body.userData.airborne) {
      const e = CONFIG.WALL_BOUNCE_RESTITUTION;
      body.velocity.x -= (1 + e) * vOut * nx;
      body.velocity.z -= (1 + e) * vOut * nz;
      body.userData.wallRicochetT = CONFIG.WALL_RICOCHET_DUR * 0.55;
      body.userData.wallRicochetPower = clamp01(vOut / CONFIG.WALL_IMPACT_HARD);
      body.userData.flightSquash = 0.72;
      emitWallImpact?.(body, vOut, nx, nz);
      return 'ricochet';
    }
    return null;
  }

  if (canClearStadiumWall(body, outward)) {
    const strength = clamp01(
      Math.max(
        outward / 18,
        (body.userData.launchBounceKbMag ?? 0) / 12,
        effectiveFlightHeight(body) / 14
      )
    );
    beginStadiumFlyOut(body, nx, nz, Math.max(0.45, strength));
    emitWallImpact?.(body, Math.max(outward, 8), nx, nz);
    return 'flyOut';
  }

  applyWallRicochet(body, nx, nz, Math.max(outward, vOut, 5), emitWallImpact);
  return 'ricochet';
}

export function resolveStadiumWallBodies(bodyA, bodyB, emitWallImpact) {
  for (const body of [bodyA, bodyB]) {
    resolveStadiumWallBody(body, emitWallImpact);
  }
}

/** Advance fly-out arcs + ricochet squash recovery. */
export function tickStadiumWallBody(body, dt) {
  if (!body) return;

  if (body.userData.wallRicochetT != null) {
    body.userData.wallRicochetT -= dt;
    const dur = CONFIG.WALL_RICOCHET_DUR;
    const t = clamp01(1 - body.userData.wallRicochetT / dur);
    const power = body.userData.wallRicochetPower ?? 0.5;
    const recover = easeOutCubic(t);

    // Pop off the wall then settle upright.
    const squashHit = 0.5 - power * 0.08;
    const stretch = 1.12 + power * 0.08;
    if (t < 0.35) {
      const p = t / 0.35;
      body.userData.flightSquash = squashHit + (stretch - squashHit) * p;
    } else {
      body.userData.flightSquash = stretch + (1 - stretch) * ((t - 0.35) / 0.65);
    }

    if (!body.userData.stadiumFlyOut && !body.userData.launchBouncePhase) {
      const tilt0 = 0.55 + power * 0.45;
      body.userData.flightTilt = tilt0 * (1 - recover);
      body.userData.flightRoll = (body.userData.flightRoll ?? 0) * (1 - recover * 0.85);
    }

    if (body.userData.wallRicochetT <= 0) {
      delete body.userData.wallRicochetT;
      delete body.userData.wallRicochetPower;
      delete body.userData.wallRicochetNx;
      delete body.userData.wallRicochetNz;
      if (!body.userData.stadiumFlyOut && !body.userData.launchBouncePhase) {
        body.userData.flightSquash = 1;
        if (!body.userData.airborne) {
          body.userData.flightTilt = 0;
          body.userData.flightRoll = 0;
        }
      }
    }
  }

  if (!body.userData.stadiumFlyOut) return;

  body.userData.stadiumFlyOutT = (body.userData.stadiumFlyOutT ?? 0) + dt;
  body.userData.airborne = true;
  body.userData.controlLocked = true;
  setBodyCollisions(body, false);
  if (body.type !== CANNON.Body.KINEMATIC) setAirborneKinematic(body);

  const nx = body.userData.stadiumFlyOutNx ?? 1;
  const nz = body.userData.stadiumFlyOutNz ?? 0;
  const speed = body.userData.stadiumFlyOutSpeed ?? CONFIG.FLY_OUT_OUT_SPEED;
  const strength = body.userData.stadiumFlyOutStrength ?? 0.7;

  // Outward glide — ease slightly so the vault reads, then accelerate off the platform.
  const t = body.userData.stadiumFlyOutT;
  const accel = 1 + Math.min(1.1, t * 0.85);
  body.position.x += nx * speed * accel * dt;
  body.position.z += nz * speed * accel * dt;
  body.previousPosition.x = body.position.x;
  body.previousPosition.z = body.position.z;
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.position.y = groundY(body);

  let vy = body.userData.stadiumFlyOutVY ?? 0;
  vy -= CONFIG.FLY_OUT_GRAVITY * dt;
  body.userData.stadiumFlyOutVY = vy;
  let lift = (body.userData.flightLift ?? 0) + vy * dt;

  // Soft floor while still over the white platform — then freefall into the void.
  const r = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const radial = Math.hypot(body.position.x, body.position.z);
  const onPlatform = radial + r <= CONFIG.PLATFORM_OUTER_RADIUS;
  if (lift < 0 && onPlatform) {
    lift = 0;
    body.userData.stadiumFlyOutVY = Math.abs(vy) * 0.28;
    body.userData.flightSquash = 0.62;
    body.userData.wallRicochetT = CONFIG.WALL_RICOCHET_DUR * 0.4;
    body.userData.wallRicochetPower = 0.35;
  }
  body.userData.flightLift = lift;

  const wobbleT = (body.userData.stadiumFlyOutWobbleT ?? 0) + dt;
  body.userData.stadiumFlyOutWobbleT = wobbleT;
  const spin = body.userData.stadiumFlyOutSpin ?? CONFIG.FLY_OUT_SPIN_RATE;
  const tumble = 0.55 + strength * 0.55;
  body.userData.flightTilt = tumble * Math.sin(wobbleT * spin);
  body.userData.flightRoll = tumble * Math.cos(wobbleT * spin * 0.87 + 0.4);
  body.userData.flightSquash = 1 + 0.08 * Math.sin(wobbleT * spin * 1.4);

  // Once off the platform, drop for real.
  if (!onPlatform && lift < -0.5) {
    body.userData.flightLift = lift;
  }
}

export function tickStadiumWallBodies(state, dt) {
  if (state.playerBody) tickStadiumWallBody(state.playerBody, dt);
  if (state.aiBody) tickStadiumWallBody(state.aiBody, dt);
}

/** True once a fly-out has cleared the rim enough to count as KO. */
export function isStadiumFlyOutKo(body) {
  if (!body?.userData?.stadiumFlyOut) return false;
  const r = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const dist = Math.hypot(body.position.x, body.position.z);
  if (dist + r * 0.25 >= CONFIG.FLY_OUT_KO_RADIUS) return true;
  if (dist + r > CONFIG.PLATFORM_OUTER_RADIUS) return true;
  if ((body.userData.stadiumFlyOutT ?? 0) >= CONFIG.FLY_OUT_MAX_DUR) return true;
  return false;
}

export function clearStadiumWallState(body) {
  if (!body) return;
  delete body.userData.stadiumFlyOut;
  delete body.userData.stadiumFlyOutT;
  delete body.userData.stadiumFlyOutNx;
  delete body.userData.stadiumFlyOutNz;
  delete body.userData.stadiumFlyOutStrength;
  delete body.userData.stadiumFlyOutVY;
  delete body.userData.stadiumFlyOutSpeed;
  delete body.userData.stadiumFlyOutSpin;
  delete body.userData.stadiumFlyOutWobbleT;
  delete body.userData.stadiumExitSource;
  delete body.userData.wallRicochetT;
  delete body.userData.wallRicochetPower;
  delete body.userData.wallRicochetNx;
  delete body.userData.wallRicochetNz;
}

/**
 * When KO cinematic starts on a fly-out victim, keep the arc instead of
 * resetting into a flat pocket slide.
 */
export function continueFlyOutAsRingOut(body) {
  if (!body?.userData?.stadiumFlyOut) return false;
  body.userData.ringOut = true;
  body.userData.ringOutT = body.userData.stadiumFlyOutT ?? 0;
  body.userData.ringOutStyle = 'flyOver';
  setBodyCollisions(body, false);
  return true;
}

export { restoreDynamicBody as restoreStadiumWallBodyType };
