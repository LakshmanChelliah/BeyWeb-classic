import * as CANNON from 'cannon-es';
import { CONFIG } from '../../config.js';
import { setBodyCollisions } from '../../physics/top.js';
import { isAtPocketAngle } from '../../physics/arena.js';
import { clamp01 } from '../../utils/math.js';
import * as C from './constants.js';
export * from './constants.js';

export function spinKey(side) {
  return side === 'player' ? 'playerSpin' : 'aiSpin';
}

export function setAirborneKinematic(body) {
  if (body.type !== CANNON.Body.KINEMATIC) {
    body.userData._prevBodyType = body.type;
    body.type = CANNON.Body.KINEMATIC;
  }
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
}

export function syncBodyPosition(body) {
  if (!body) return;
  body.previousPosition.x = body.position.x;
  body.previousPosition.y = body.position.y;
  body.previousPosition.z = body.position.z;
}

export function restoreDynamicBody(body) {
  body.type = body.userData._prevBodyType ?? CANNON.Body.DYNAMIC;
  delete body.userData._prevBodyType;
  body.velocity.set(0, 0, 0);
}

export function isPocketAngle(angle) {
  return isAtPocketAngle(angle, 1.15);
}

/** Nearest solid wall point along the rim (avoids KO pockets). */
export function pickWallTarget(body) {
  const r = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const maxR = CONFIG.WALL_RADIUS - r - 0.04;
  let angle = Math.atan2(body.position.z, body.position.x);
  if (isPocketAngle(angle)) {
    let best = angle;
    let bestDist = Infinity;
    for (let i = 0; i < CONFIG.POCKET_ANGLES.length; i++) {
      const pocketStart = CONFIG.POCKET_ANGLES[i];
      const pocketEnd = CONFIG.POCKET_ANGLES[(i + 1) % CONFIG.POCKET_ANGLES.length];
      let wallStart = pocketStart + CONFIG.POCKET_HALF_WIDTH;
      let wallEnd = pocketEnd - CONFIG.POCKET_HALF_WIDTH;
      if (wallEnd < wallStart) wallEnd += Math.PI * 2;
      const mid = (wallStart + wallEnd) * 0.5;
      let delta = Math.abs(angle - mid);
      if (delta > Math.PI) delta = 2 * Math.PI - delta;
      if (delta < bestDist) {
        bestDist = delta;
        best = mid;
      }
    }
    angle = best;
  }
  return {
    x: Math.cos(angle) * maxR,
    z: Math.sin(angle) * maxR,
    nx: -Math.cos(angle),
    nz: -Math.sin(angle),
  };
}

export function homingXZ(body, opp, rate) {
  if (!opp) return;
  const t = Math.min(1, rate);
  body.position.x += (opp.position.x - body.position.x) * t;
  body.position.z += (opp.position.z - body.position.z) * t;
}

/** Set dash heading toward the opponent, target on the far stadium wall. */
export function initBullDashTarget(body, opp) {
  const fromX = body.userData.bullChargeFromX ?? body.position.x;
  const fromZ = body.userData.bullChargeFromZ ?? body.position.z;
  let nx = (opp?.position.x ?? body.position.x) - fromX;
  let nz = (opp?.position.z ?? body.position.z) - fromZ;
  const d = Math.hypot(nx, nz);
  if (d < 0.05) {
    const yaw = Math.atan2(body.position.z, body.position.x);
    nx = Math.cos(yaw);
    nz = Math.sin(yaw);
  } else {
    nx /= d;
    nz /= d;
  }
  body.userData.bullCoastNx = nx;
  body.userData.bullCoastNz = nz;

  const r = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const maxR = CONFIG.WALL_RADIUS - r - 0.04;
  const angle = Math.atan2(nz, nx);
  body.userData.bullCoastTargetX = Math.cos(angle) * maxR;
  body.userData.bullCoastTargetZ = Math.sin(angle) * maxR;
  body.userData.bullCoastDist = Math.hypot(
    body.userData.bullCoastTargetX - body.position.x,
    body.userData.bullCoastTargetZ - body.position.z
  );
}

/** Constant-speed dash; returns true once the far wall is reached. */
export function stepBullDash(state, side, body, opp, dt) {
  if (body.userData.bullCoastTargetX == null) initBullDashTarget(body, opp);

  body.userData.bullUpperPhaseT = (body.userData.bullUpperPhaseT ?? 0) + dt;

  // Refresh aim line through the foe for the first fraction of the dash.
  if (opp && body.userData.bullUpperPhaseT < C.BULL_DASH_AIM_TRACK_DUR) {
    initBullDashTarget(body, opp);
  }

  const tx = body.userData.bullCoastTargetX;
  const tz = body.userData.bullCoastTargetZ;
  const dx = tx - body.position.x;
  const dz = tz - body.position.z;
  const remain = Math.hypot(dx, dz);

  body.userData.bullUpperSlamming = true;
  body.position.y = C.groundY(body);

  if (remain < C.BULL_COAST_ARRIVE) {
    body.position.x = tx;
    body.position.z = tz;
    return true;
  }

  const move = Math.min(C.BULL_DASH_SPEED * dt, remain);
  body.position.x += (dx / remain) * move;
  body.position.z += (dz / remain) * move;

  if (opp && bullUppercutOverlap(body, opp) && !bullUppercutVictimImmune(state, body, opp)) {
    applyBullUppercutHit(state, side, body, opp);
  }

  return false;
}

export function stepBullUppercutDash(state, dt) {
  for (const side of ['player', 'ai']) {
    const spSlot = state.abilities?.[side]?.special;
    if (!spSlot?.active || spSlot.ability.id !== 'bull_red_horn_uppercut') continue;
    const body = side === 'player' ? state.playerBody : state.aiBody;
    const opp = side === 'player' ? state.aiBody : state.playerBody;
    if (!body || body.userData.bullUpperPhase !== 'dash') continue;
    if (stepBullDash(state, side, body, opp, dt)) {
      body.userData.bullDashDone = true;
    }
  }
}

export function initStrikerDashTarget(body, opp) {
  const fromX = body.userData.strikerChargeFromX ?? body.position.x;
  const fromZ = body.userData.strikerChargeFromZ ?? body.position.z;
  let nx = (opp?.position.x ?? body.position.x) - fromX;
  let nz = (opp?.position.z ?? body.position.z) - fromZ;
  const d = Math.hypot(nx, nz);
  if (d < 0.05) {
    const yaw = Math.atan2(body.position.z, body.position.x);
    nx = Math.cos(yaw);
    nz = Math.sin(yaw);
  } else {
    nx /= d;
    nz /= d;
  }
  body.userData.strikerCoastNx = nx;
  body.userData.strikerCoastNz = nz;

  const r = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const maxR = CONFIG.WALL_RADIUS - r - 0.04;
  const angle = Math.atan2(nz, nx);
  body.userData.strikerCoastTargetX = Math.cos(angle) * maxR;
  body.userData.strikerCoastTargetZ = Math.sin(angle) * maxR;
}

/** Snap Ray Striker behind the rival along the attack line (anime blink-in). */
export function teleportStrikerForFlash(body, opp) {
  if (!opp) return;
  const fromX = body.userData.strikerVanishX ?? body.position.x;
  const fromZ = body.userData.strikerVanishZ ?? body.position.z;
  let nx = opp.position.x - fromX;
  let nz = opp.position.z - fromZ;
  const d = Math.hypot(nx, nz);
  if (d < 0.05) {
    const yaw = Math.atan2(body.position.z, body.position.x);
    nx = Math.cos(yaw);
    nz = Math.sin(yaw);
  } else {
    nx /= d;
    nz /= d;
  }
  const rA = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const rB = opp.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const lead = rA + rB + C.STRIKER_TELEPORT_LEAD;
  body.position.x = opp.position.x - nx * lead;
  body.position.z = opp.position.z - nz * lead;
  body.position.y = C.groundY(body);
  body.userData.strikerChargeFromX = body.position.x;
  body.userData.strikerChargeFromZ = body.position.z;
  initStrikerDashTarget(body, opp);
  syncBodyPosition(body);
}

export function advanceStrikerFlashDash(state, side, body, opp, dt) {
  if (body.userData.strikerCoastTargetX == null) initStrikerDashTarget(body, opp);

  body.userData.strikerFlashPhaseT = (body.userData.strikerFlashPhaseT ?? 0) + dt;
  if (opp && body.userData.strikerFlashPhaseT < C.STRIKER_DASH_AIM_TRACK) {
    initStrikerDashTarget(body, opp);
  }

  const tx = body.userData.strikerCoastTargetX;
  const tz = body.userData.strikerCoastTargetZ;
  const dx = tx - body.position.x;
  const dz = tz - body.position.z;
  const remain = Math.hypot(dx, dz);

  body.userData.strikerSlamming = true;
  body.userData.slamming = true;
  body.position.y = C.groundY(body);

  if (remain < C.STRIKER_COAST_ARRIVE) {
    body.position.x = tx;
    body.position.z = tz;
    syncBodyPosition(body);
    return true;
  }

  const move = Math.min(C.STRIKER_DASH_SPEED * dt, remain);
  body.position.x += (dx / remain) * move;
  body.position.z += (dz / remain) * move;
  syncBodyPosition(body);

  if (opp && strikerFlashOverlap(body, opp) && !body.userData.strikerFlashHit) {
    applyStrikerFlashHit(state, side, body, opp);
  }

  return false;
}

export function strikerFlashOverlap(body, opp) {
  if (!body || !opp) return false;
  const dx = body.position.x - opp.position.x;
  const dz = body.position.z - opp.position.z;
  const rA = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const rB = opp.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const reach = (rA + rB) * 1.08;
  return dx * dx + dz * dz <= reach * reach;
}

export function applyStrikerFlashHit(state, side, body, opp) {
  if (!body || !opp || body.userData.strikerFlashHit) return;
  body.userData.strikerFlashHit = true;
  let nx = opp.position.x - body.position.x;
  let nz = opp.position.z - body.position.z;
  const d = Math.hypot(nx, nz) || 1;
  nx /= d;
  nz /= d;
  applyPhysicsKnockback(opp, nx, nz, C.STRIKER_FLASH_KB);
  const victimSpinKey = side === 'player' ? 'aiSpin' : 'playerSpin';
  state[victimSpinKey] = Math.max(0, state[victimSpinKey] - C.STRIKER_FLASH_SPIN);
  body.userData.strikerImpactFlash = true;
}

export function pinStrikerFlashPhysics(body) {
  if (!body) return;
  if (body.type !== CANNON.Body.KINEMATIC) setAirborneKinematic(body);
  setBodyCollisions(body, false);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.position.y = C.groundY(body);
}

export function releaseStrikerFlashControl(body) {
  if (!body) return;
  body.userData.airborne = false;
  body.userData.controlLocked = false;
  body.userData.invulnerable = false;
  body.userData.slamming = false;
  body.userData.strikerSlamming = false;
  delete body.userData.strikerFlashPhase;
  delete body.userData.strikerFlashPhaseT;
  delete body.userData.strikerCoastTargetX;
  delete body.userData.strikerCoastTargetZ;
  delete body.userData.strikerCoastNx;
  delete body.userData.strikerCoastNz;
  delete body.userData.strikerChargeFromX;
  delete body.userData.strikerChargeFromZ;
  delete body.userData.strikerFlashHit;
  delete body.userData.strikerImpactFlash;
  delete body.userData.strikerImpactFlashT;
  delete body.userData.strikerDashDone;
  delete body.userData.strikerWindupEndTilt;
  delete body.userData.topVanish;
  delete body.userData.strikerVanishX;
  delete body.userData.strikerVanishZ;
  delete body.userData.strikerReappearFlash;
  body.userData.flightLift = 0;
  body.userData.flightTilt = 0;
  body.userData.flightRoll = 0;
  body.userData.flightSquash = 1;
  setBodyCollisions(body, true);
  if (body.type === CANNON.Body.KINEMATIC) restoreDynamicBody(body);
}

export function finishStrikerFlash(state, side, slot, body, dt) {
  if (!body.userData.strikerFlashHit) {
    const selfSpinKey = spinKey(side);
    state[selfSpinKey] = Math.max(0, state[selfSpinKey] - C.STRIKER_FLASH_MISS_SELF);
  }
  releaseStrikerFlashControl(body);
  if (slot.ability.onEnd) slot.ability.onEnd(makeCtx(state, side, dt));
  slot.active = false;
  slot.activeRemaining = 0;
  slot.windupRemaining = 0;
  slot.windupDuration = 0;
}


export function initLdragoAbsorbTarget(body, opp) {
  const fromX = body.userData.ldragoAbsorbFromX ?? body.position.x;
  const fromZ = body.userData.ldragoAbsorbFromZ ?? body.position.z;
  let nx = (opp?.position.x ?? body.position.x) - fromX;
  let nz = (opp?.position.z ?? body.position.z) - fromZ;
  const d = Math.hypot(nx, nz);
  if (d < 0.05) {
    const yaw = Math.atan2(body.position.z, body.position.x);
    nx = Math.cos(yaw);
    nz = Math.sin(yaw);
  } else {
    nx /= d;
    nz /= d;
  }
  body.userData.ldragoAbsorbNx = nx;
  body.userData.ldragoAbsorbNz = nz;

  const r = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const maxR = CONFIG.WALL_RADIUS - r - 0.04;
  const angle = Math.atan2(nz, nx);
  body.userData.ldragoAbsorbTargetX = Math.cos(angle) * maxR;
  body.userData.ldragoAbsorbTargetZ = Math.sin(angle) * maxR;
}

export function ldragoAbsorbOverlap(body, opp) {
  if (!body || !opp) return false;
  const dx = body.position.x - opp.position.x;
  const dz = body.position.z - opp.position.z;
  const rA = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const rB = opp.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const reach = (rA + rB) * 1.1;
  return dx * dx + dz * dz <= reach * reach;
}

export function applyLdragoAbsorbHit(state, side, body, opp) {
  if (!body || !opp || body.userData.ldragoAbsorbHit) return;
  if (opp.userData?.invulnerable) return;
  body.userData.ldragoAbsorbHit = true;
  let nx = opp.position.x - body.position.x;
  let nz = opp.position.z - body.position.z;
  const d = Math.hypot(nx, nz) || 1;
  nx /= d;
  nz /= d;
  applyPhysicsKnockback(opp, nx, nz, C.LDRAGO_ABSORB_HIT_KB);
  const victimSpinKey = side === 'player' ? 'aiSpin' : 'playerSpin';
  const attackerSpinKey = spinKey(side);
  const stolen = Math.min(state[victimSpinKey], C.LDRAGO_ABSORB_HIT_SPIN);
  state[victimSpinKey] = Math.max(0, state[victimSpinKey] - stolen);
  state[attackerSpinKey] = Math.min(1, state[attackerSpinKey] + stolen * 0.65 + C.LDRAGO_ABSORB_STEAL_GAIN);
  body.userData.spinStealBurstT = 1;
  body.userData.spinStealFromX = opp.position.x;
  body.userData.spinStealFromZ = opp.position.z;
  body.userData.ldragoAbsorbImpact = true;
  body.userData.ldragoAbsorbImpactT = 0;
}

export function releaseLdragoAbsorbControl(body) {
  if (!body) return;
  body.userData.airborne = false;
  body.userData.controlLocked = false;
  body.userData.invulnerable = false;
  delete body.userData.ldragoAbsorbPhase;
  delete body.userData.ldragoAbsorbPhaseT;
  delete body.userData.ldragoAbsorbTargetX;
  delete body.userData.ldragoAbsorbTargetZ;
  delete body.userData.ldragoAbsorbNx;
  delete body.userData.ldragoAbsorbNz;
  delete body.userData.ldragoAbsorbFromX;
  delete body.userData.ldragoAbsorbFromZ;
  delete body.userData.ldragoAbsorbHit;
  delete body.userData.ldragoAbsorbWindup;
  delete body.userData.ldragoAbsorbRush;
  delete body.userData.ldragoAbsorbImpact;
  delete body.userData.ldragoAbsorbImpactT;
  delete body.userData.ldragoAbsorbDashDone;
  delete body.userData.ldragoAbsorbCoilTilt;
  body.userData.flightLift = 0;
  body.userData.flightTilt = 0;
  body.userData.flightRoll = 0;
  body.userData.flightSquash = 1;
  setBodyCollisions(body, true);
  if (body.type === CANNON.Body.KINEMATIC) restoreDynamicBody(body);
}

export function finishLdragoAbsorb(state, side, slot, body, dt) {
  if (!body.userData.ldragoAbsorbHit) {
    const selfSpinKey = spinKey(side);
    state[selfSpinKey] = Math.max(0, state[selfSpinKey] - C.LDRAGO_ABSORB_MISS_SELF);
  }
  releaseLdragoAbsorbControl(body);
  if (slot.ability.onEnd) slot.ability.onEnd(makeCtx(state, side, dt));
  slot.active = false;
  slot.activeRemaining = 0;
  slot.windupRemaining = 0;
  slot.windupDuration = 0;
}

export function advanceLdragoAbsorbRush(state, side, body, opp, dt) {
  if (body.userData.ldragoAbsorbTargetX == null) initLdragoAbsorbTarget(body, opp);

  body.userData.ldragoAbsorbPhaseT = (body.userData.ldragoAbsorbPhaseT ?? 0) + dt;
  if (opp && body.userData.ldragoAbsorbPhaseT < C.LDRAGO_ABSORB_DASH_AIM_TRACK) {
    initLdragoAbsorbTarget(body, opp);
  }

  const tx = body.userData.ldragoAbsorbTargetX;
  const tz = body.userData.ldragoAbsorbTargetZ;
  const dx = tx - body.position.x;
  const dz = tz - body.position.z;
  const remain = Math.hypot(dx, dz);

  body.userData.ldragoAbsorbRush = true;
  body.position.y = C.groundY(body);

  if (remain < C.LDRAGO_ABSORB_COAST_ARRIVE) {
    body.position.x = tx;
    body.position.z = tz;
    return true;
  }

  const move = Math.min(C.LDRAGO_ABSORB_DASH_SPEED * dt, remain);
  body.position.x += (dx / remain) * move;
  body.position.z += (dz / remain) * move;

  if (opp && ldragoAbsorbOverlap(body, opp)) {
    applyLdragoAbsorbHit(state, side, body, opp);
    return true;
  }

  return false;
}

export function stepLdragoAbsorbRush(state, dt) {
  for (const side of ['player', 'ai']) {
    const spSlot = state.abilities?.[side]?.special;
    if (!spSlot?.active || spSlot.ability.id !== 'ldrago_absorb_break') continue;
    const body = side === 'player' ? state.playerBody : state.aiBody;
    const opp = side === 'player' ? state.aiBody : state.playerBody;
    if (!body || body.userData.ldragoAbsorbPhase !== 'rush') continue;
    if (advanceLdragoAbsorbRush(state, side, body, opp, dt)) {
      body.userData.ldragoAbsorbDashDone = true;
    }
  }
}

export function pullTowardAbsorb(body, opp, rate) {
  if (!body || !opp) return;
  const t = Math.min(1, rate);
  opp.position.x += (body.position.x - opp.position.x) * t * 0.35;
  opp.position.z += (body.position.z - opp.position.z) * t * 0.35;
}


/** Physics-rate phase machine for Lightning Sword Flash (windup homing, vanish pin, teleport, dash). */
export function stepStrikerFlashPhases(state, dt) {
  for (const side of ['player', 'ai']) {
    const spSlot = state.abilities?.[side]?.special;
    if (!spSlot || spSlot.ability.id !== 'striker_lightning_flash') continue;
    const body = side === 'player' ? state.playerBody : state.aiBody;
    const opp = side === 'player' ? state.aiBody : state.playerBody;
    if (!body) continue;

    const inMove =
      spSlot.windupRemaining > 0 ||
      spSlot.active ||
      body.userData.strikerFlashPhase != null;
    if (!inMove) continue;

    pinStrikerFlashPhysics(body);

    if (spSlot.windupRemaining > 0) {
      body.userData.strikerFlashPhase = 'windup';
      const windup = C.slotWindupTotal(spSlot, C.STRIKER_FLASH_WINDUP);
      const t = clamp01(1 - spSlot.windupRemaining / windup);
      if (t > 0.45 && opp) {
        homingXZ(body, opp, 6 * dt);
        syncBodyPosition(body);
      }
      continue;
    }

    if (!spSlot.active && body.userData.strikerFlashPhase == null) continue;

    const phase = body.userData.strikerFlashPhase;

    if (phase === 'vanish') {
      body.position.x = body.userData.strikerVanishX ?? body.position.x;
      body.position.z = body.userData.strikerVanishZ ?? body.position.z;
      syncBodyPosition(body);
      body.userData.strikerFlashPhaseT = (body.userData.strikerFlashPhaseT ?? 0) + dt;
      if (body.userData.strikerFlashPhaseT >= C.STRIKER_VANISH_DUR) {
        teleportStrikerForFlash(body, opp);
        body.userData.strikerFlashPhase = 'reappear';
        body.userData.strikerFlashPhaseT = 0;
        body.userData.strikerReappearFlash = 1;
      }
      continue;
    }

    if (phase === 'reappear') {
      syncBodyPosition(body);
      body.userData.strikerFlashPhaseT = (body.userData.strikerFlashPhaseT ?? 0) + dt;
      if (body.userData.strikerFlashPhaseT >= C.STRIKER_REAPPEAR_DUR) {
        body.userData.strikerFlashPhase = 'dash';
        body.userData.strikerFlashPhaseT = 0;
        body.userData.slamming = true;
        initStrikerDashTarget(body, opp);
        delete body.userData.strikerReappearFlash;
        delete body.userData.topVanish;
      }
      continue;
    }

    if (phase !== 'dash') continue;

    if (advanceStrikerFlashDash(state, side, body, opp, dt)) {
      body.userData.strikerDashDone = true;
    }
    if (body.userData.strikerDashDone) {
      delete body.userData.strikerDashDone;
      finishStrikerFlash(state, side, spSlot, body, dt);
    }
  }
}

/** Cinematic knockback for Pegasus (velocity zeroed each frame during Star Blast). */
export function addStarKnockback(body, nx, nz, distance) {
  if (!body || distance <= 0) return;
  const speed = distance * C.STAR_KB_DAMP;
  body.userData.starKnockbackVX = (body.userData.starKnockbackVX ?? 0) + nx * speed;
  body.userData.starKnockbackVZ = (body.userData.starKnockbackVZ ?? 0) + nz * speed;
}

export function integrateStarKnockback(body, dt) {
  if (!body) return;
  let vx = body.userData.starKnockbackVX ?? 0;
  let vz = body.userData.starKnockbackVZ ?? 0;
  if (Math.abs(vx) < 0.02 && Math.abs(vz) < 0.02) {
    delete body.userData.starKnockbackVX;
    delete body.userData.starKnockbackVZ;
    return;
  }
  body.position.x += vx * dt;
  body.position.z += vz * dt;
  const decay = Math.exp(-C.STAR_KB_DAMP * dt);
  body.userData.starKnockbackVX = vx * decay;
  body.userData.starKnockbackVZ = vz * decay;
}

/** Smooth knockback for the opponent — physics velocity only, never a position snap. */
export function applyPhysicsKnockback(body, nx, nz, distance) {
  if (!body || distance <= 0) return;
  const speed = distance * C.STAR_PHYSICS_KB_SCALE;
  body.velocity.x += nx * speed;
  body.velocity.z += nz * speed;
}

export function pickLightningSpots(count) {
  const spots = [];
  const maxR = CONFIG.WALL_RADIUS - 2.8;
  const minDist = C.LDRAGO_LIGHTNING_RADIUS * 2.1;
  let attempts = 0;
  while (spots.length < count && attempts < 100) {
    attempts += 1;
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * maxR * 0.88;
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const tooClose = spots.some((s) => {
      const dx = s.x - x;
      const dz = s.z - z;
      return dx * dx + dz * dz < minDist * minDist;
    });
    if (tooClose) continue;
    spots.push({ x, z, flashT: 0 });
  }
  while (spots.length < count) {
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * maxR * 0.88;
    spots.push({ x: Math.cos(angle) * r, z: Math.sin(angle) * r, flashT: 0 });
  }
  return spots;
}

export function isInLightningZone(body, spot, radius) {
  const dx = body.position.x - spot.x;
  const dz = body.position.z - spot.z;
  return dx * dx + dz * dz <= radius * radius;
}

export function applyLightningStrike(state, casterBody, spot) {
  spot.flashT = 1;
  for (const side of ['player', 'ai']) {
    const body = side === 'player' ? state.playerBody : state.aiBody;
    if (!body || body === casterBody || body.userData.ringOut) continue;
    if (body.userData.invulnerable) continue;
    if (!isInLightningZone(body, spot, C.LDRAGO_LIGHTNING_RADIUS)) continue;

    const k = spinKey(side);
    state[k] = Math.max(0, state[k] - C.STAR_BLAST_HIT_SPIN);
    // Star Blast-style connect: launch the victim away from L-Drago (the caster),
    // not radially from the strike point. Matches Pegasus Star Blast feel.
    applyStarBlastHitKnockback(casterBody, body);
  }
}

export function tickLdragoSupremeFlightLightning(state, body, dt) {
  const ft = body.userData.ldragoFlightT ?? 0;
  const chargeStart = C.LDRAGO_FLIGHT_LAUNCH_DUR;
  const strikeStart = chargeStart + C.LDRAGO_LIGHTNING_CHARGE_DUR;

  if (ft >= chargeStart && !body.userData.ldragoLightningSpots) {
    body.userData.ldragoLightningSpots = pickLightningSpots(C.LDRAGO_LIGHTNING_COUNT);
    body.userData.ldragoLightningFired = 0;
  }

  const spots = body.userData.ldragoLightningSpots;
  if (spots) {
    for (const spot of spots) {
      if (spot.flashT > 0) {
        spot.flashT = Math.max(0, spot.flashT - dt * 2.6);
      }
    }
  }

  if (!spots || ft < strikeStart) return;

  const strikeIdx = Math.floor((ft - strikeStart) / C.LDRAGO_LIGHTNING_STRIKE_INTERVAL);
  let fired = body.userData.ldragoLightningFired ?? 0;
  while (fired <= strikeIdx && fired < C.LDRAGO_LIGHTNING_COUNT) {
    applyLightningStrike(state, body, spots[fired]);
    fired += 1;
  }
  body.userData.ldragoLightningFired = fired;
}

export function applyStarBounceKnockback(body, opp, contactSpeed) {
  const kb = Math.min(C.STAR_BOUNCE_KNOCKBACK, contactSpeed * C.STAR_BOUNCE_KB_SCALE);
  if (kb <= 0) return;

  if (!opp) {
    const d = Math.hypot(body.position.x, body.position.z) || 1;
    addStarKnockback(body, body.position.x / d, body.position.z / d, kb * 0.55);
    return;
  }

  let dx = body.position.x - opp.position.x;
  let dz = body.position.z - opp.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const nx = dx / d;
  const nz = dz / d;
  addStarKnockback(body, nx, nz, kb);

  const overlapping = starBlastOverlap(body, opp);
  const oppKb = overlapping ? kb * C.STAR_BOUNCE_OPP_MULT : kb * 0.45;
  applyPhysicsKnockback(opp, -nx, -nz, oppKb);
}

export function applyStarBlastHitKnockback(body, opp, strength = C.STAR_BLAST_HIT_KNOCKBACK) {
  if (!body || !opp || strength <= 0) return;
  let dx = opp.position.x - body.position.x;
  let dz = opp.position.z - body.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const nx = dx / d;
  const nz = dz / d;
  applyPhysicsKnockback(opp, nx, nz, strength);
  addStarKnockback(body, -nx, -nz, strength * 0.3);
}

export function starBlastOverlap(body, opp) {
  if (!body || !opp) return false;
  const dx = body.position.x - opp.position.x;
  const dz = body.position.z - opp.position.z;
  const rA = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const rB = opp.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const reach = rA + rB;
  return dx * dx + dz * dz <= reach * reach;
}

export function markStarBlastHit(state, attackerSide, body, opp) {
  if (!body || body.userData.starBlastHit) return;
  if (opp?.userData?.invulnerable) return;
  body.userData.starBlastHit = true;
  const oppSide = attackerSide === 'player' ? 'ai' : 'player';
  const k = spinKey(oppSide);
  state[k] = Math.max(0, state[k] - C.STAR_BLAST_HIT_SPIN);
  applyStarBlastHitKnockback(body, opp);
}

export function resolveStarBlastOutcome(state, side, body) {
  if (!body || body.userData.starBlastResolved) return;
  body.userData.starBlastResolved = true;
  if (!body.userData.starBlastHit) {
    const k = spinKey(side);
    state[k] = Math.max(0, state[k] - C.STAR_BLAST_MISS_SELF);
  }
}

export function initStarBlast(body) {
  const wall = pickWallTarget(body);
  body.userData.starWallX = wall.x;
  body.userData.starWallZ = wall.z;
  body.userData.starWallNx = wall.nx;
  body.userData.starWallNz = wall.nz;
  body.userData.starBlastWindup = true;
  body.userData.starPhaseT = 0;
  body.userData.starImpactFlash = false;
  body.userData.starBlastHit = false;
  delete body.userData.starPhase;
  delete body.userData.starBlastResolved;
  setBodyCollisions(body, false);
}

export function finishStarBlast(state, side, slot, body, dt) {
  if (!body || (!slot.active && body.userData.starPhase == null)) return;
  resolveStarBlastOutcome(state, side, body);
  slot.active = false;
  slot.activeRemaining = 0;
  slot.windupRemaining = 0;
  if (slot.ability.onEnd) slot.ability.onEnd(makeCtx(state, side, dt));
}

/** Restores player/AI steering and dynamic physics after Star Blast (or on reset). */
export function releaseStarBlastControl(body) {
  if (!body) return;
  body.userData.controlLocked = false;
  body.userData.airborne = false;
  clearStarBlastMotion(body);
  delete body.userData.starBlastWindup;
  delete body.userData.starPhase;
  delete body.userData.starPhaseT;
  delete body.userData.starImpactFlash;
  delete body.userData.starWallX;
  delete body.userData.starWallZ;
  delete body.userData.starWallNx;
  delete body.userData.starWallNz;
  setBodyCollisions(body, true);
  if (body.type === CANNON.Body.KINEMATIC) {
    restoreDynamicBody(body);
  }
  body.position.y = C.groundY(body);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
}

export function clearEagleDiveMotion(body) {
  if (!body) return;
  body.userData.flightLift = 0;
  body.userData.flightTilt = 0;
  body.userData.flightRoll = 0;
  body.userData.flightSquash = 1;
  body.userData.slamming = false;
  body.userData.eagleDiveSlamming = false;
  body.userData.eagleImpactFlash = false;
  delete body.userData.eagleDivePhase;
  delete body.userData.eagleDivePhaseT;
  delete body.userData.eagleDiveHit;
  delete body.userData.eagleDiveResolved;
  delete body.userData.eagleDiveSettleTilt;
  delete body.userData.eagleDiveSettleRoll;
  delete body.userData.eagleDiveTargetX;
  delete body.userData.eagleDiveTargetZ;
}

export function releaseEagleDiveControl(body) {
  if (!body) return;
  body.userData.controlLocked = false;
  body.userData.airborne = false;
  body.userData.invulnerable = false;
  body.userData.eagleDiveWindup = false;
  clearEagleDiveMotion(body);
  setBodyCollisions(body, true);
  if (body.type === CANNON.Body.KINEMATIC) {
    restoreDynamicBody(body);
  }
  body.position.y = C.groundY(body);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
}

export function resolveEagleDiveOutcome(state, side, body) {
  if (!body || body.userData.eagleDiveResolved) return;
  body.userData.eagleDiveResolved = true;
  if (!body.userData.eagleDiveHit) {
    const k = spinKey(side);
    state[k] = Math.max(0, state[k] - C.EAGLE_DIVE_MISS_SELF);
  }
}

export function finishEagleDive(state, side, slot, body, dt) {
  if (!body || (!slot.active && body.userData.eagleDivePhase == null)) return;
  resolveEagleDiveOutcome(state, side, body);
  slot.active = false;
  slot.activeRemaining = 0;
  slot.windupRemaining = 0;
  if (slot.ability.onEnd) slot.ability.onEnd(makeCtx(state, side, dt));
}

export function lockEagleDiveTarget(body, opp) {
  if (!body) return;
  body.userData.eagleDiveTargetX = opp?.position.x ?? body.position.x;
  body.userData.eagleDiveTargetZ = opp?.position.z ?? body.position.z;
}

export function moveTowardEagleDiveTarget(body, rate) {
  if (!body) return;
  const tx = body.userData.eagleDiveTargetX ?? body.position.x;
  const tz = body.userData.eagleDiveTargetZ ?? body.position.z;
  const t = Math.min(1, rate);
  body.position.x += (tx - body.position.x) * t;
  body.position.z += (tz - body.position.z) * t;
}

export function clearStarBlastMotion(body) {
  body.userData.flightLift = 0;
  body.userData.flightTilt = 0;
  body.userData.flightRoll = 0;
  body.userData.flightSquash = 1;
  body.userData.slamming = false;
  body.userData.starImpactFlash = false;
  body.userData.starVY = 0;
  delete body.userData.starBlastHit;
  delete body.userData.starBlastResolved;
  delete body.userData.starBouncePulseT;
  delete body.userData.starImpactX;
  delete body.userData.starImpactZ;
  delete body.userData.starDashFromX;
  delete body.userData.starDashFromZ;
  delete body.userData.starSettleTilt;
  delete body.userData.starSettleRoll;
  delete body.userData.starKnockbackVX;
  delete body.userData.starKnockbackVZ;
}

export function clearSonicSlow(body) {
  if (!body) return;
  if (body.userData._sonicSlowBaseSteer != null) {
    body.userData.steerMult = body.userData._sonicSlowBaseSteer;
    delete body.userData._sonicSlowBaseSteer;
  }
  delete body.userData.sonicSlow;
  delete body.userData.sonicPull;
}

export function clearLibraSandBoost(body) {
  if (!body) return;
  if (body.userData._sonicSandBaseSteer != null) {
    body.userData.steerMult = body.userData._sonicSandBaseSteer;
    delete body.userData._sonicSandBaseSteer;
  }
  delete body.userData.sonicSandBoost;
}

export function clearLibraBusterVibrate(body) {
  if (!body) return;
  delete body.userData.sonicBusterVibrateT;
  delete body.userData.sonicBusterVisualSpinMult;
  delete body.userData.sonicBusterFromX;
  delete body.userData.sonicBusterFromZ;
  delete body.userData.flightOffsetX;
  delete body.userData.flightOffsetZ;
}

export function bullUppercutKbScale(victim) {
  const dist = Math.hypot(victim.position.x, victim.position.z);
  const t = clamp01(dist / (CONFIG.ARENA_RADIUS * 0.92));
  return 0.42 + t * 0.83;
}

export function bullUppercutSpinLoss(victim) {
  const dist = Math.hypot(victim.position.x, victim.position.z);
  const t = clamp01(dist / (CONFIG.ARENA_RADIUS * 0.92));
  return C.BULL_UPPERCUT_SPIN_MIN + t * (C.BULL_UPPERCUT_SPIN_MAX - C.BULL_UPPERCUT_SPIN_MIN);
}

export function bullUppercutOverlap(body, opp) {
  if (!body || !opp) return false;
  const dx = body.position.x - opp.position.x;
  const dz = body.position.z - opp.position.z;
  const rA = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const rB = opp.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const reachMult = body.userData.bullUpperSlamming ? 1.12 : 1;
  const reach = (rA + rB) * reachMult;
  return dx * dx + dz * dz <= reach * reach;
}

/** Leone's wall / guards and vertical separation block Bull's ground dash uppercut. */
export function readContactLift(body) {
  if (!body) return 0;
  if (body.userData.contactLift != null) return body.userData.contactLift;
  return body.userData.flightLift ?? 0;
}

export function leoneWallContactLift(state, body) {
  if (!body?.userData?.lionWall && !body?.userData?.lionWallWindup) {
    return readContactLift(body);
  }
  const side = body.userData.side;
  const slot = side && state.abilities?.[side]?.special;
  if (!slot || slot.ability.id !== 'leone_lion_wall') return readContactLift(body);
  if (slot.windupRemaining > 0) {
    const windup = C.slotWindupTotal(slot, 0.45);
    const t = clamp01(1 - slot.windupRemaining / windup);
    return C.LEONE_WALL_HOVER_BASE * C.easeOutQuad(t);
  }
  if (slot.active) {
    const wt = body.userData.lionWallT ?? 0;
    return C.LEONE_WALL_HOVER_BASE + Math.sin(wt * 4.2) * C.LEONE_WALL_HOVER_BOB;
  }
  return readContactLift(body);
}

export function bullUppercutVictimImmune(state, attacker, victim) {
  if (!victim) return true;
  if (victim.userData.invulnerable) return true;
  if (victim.userData.bullFlipPhase) return true;
  if (victim.userData.lionWall || victim.userData.lionWallWindup || victim.userData.guarding) {
    return true;
  }

  const victimLift = leoneWallContactLift(state, victim);
  const attackerLift = readContactLift(attacker);
  const rA = attacker.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const rB = victim.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const reach = (rA + rB) * 0.78;
  return Math.abs(victimLift - attackerLift) > reach;
}

export function applyBullUppercutHit(state, attackerSide, attacker, victim) {
  if (!attacker || !victim || bullUppercutVictimImmune(state, attacker, victim)) return;
  if (!attacker.userData.bullUpperHit) attacker.userData.bullUpperHit = true;

  let dx = victim.position.x - attacker.position.x;
  let dz = victim.position.z - attacker.position.z;
  const d = Math.hypot(dx, dz) || 1;
  const nx = dx / d;
  const nz = dz / d;
  const kb = C.BULL_UPPERCUT_BASE_KB * bullUppercutKbScale(victim);

  const oppSide = attackerSide === 'player' ? 'ai' : 'player';
  const k = spinKey(oppSide);
  state[k] = Math.max(0, state[k] - bullUppercutSpinLoss(victim));

  const posScale = bullUppercutKbScale(victim);

  victim.userData.bullFlipFromX = victim.position.x;
  victim.userData.bullFlipFromZ = victim.position.z;
  victim.userData.bullFlipKbNx = nx;
  victim.userData.bullFlipKbNz = nz;
  victim.userData.bullFlipKbMag = kb;
  victim.userData.bullFlipPhase = 'air';
  victim.userData.bullFlipPhaseT = 0;
  victim.userData.bullFlipElapsed = 0;
  delete victim.userData.bullFlipFalling;
  delete victim.userData.bullFlipVY;
  delete victim.userData.bullFlipWobbleT;
  victim.userData.bullFlipPeakLift = C.BULL_UPPERCUT_LIFT * posScale;
  victim.userData.flightTilt = 0;
  victim.userData.flightRoll = 0;
  victim.userData.flightLift = 0;
  victim.userData.flightSquash = 1.04;
  victim.userData.airborne = true;
  victim.userData.controlLocked = true;
  victim.userData.bullFlipBurstT = 1;
  setBodyCollisions(victim, false);
  setAirborneKinematic(victim);
  victim.velocity.set(0, 0, 0);
  victim.angularVelocity.set(0, 0, 0);

  attacker.userData.bullImpactFlash = true;
  attacker.userData.bullImpactX = (attacker.position.x + victim.position.x) * 0.5;
  attacker.userData.bullImpactZ = (attacker.position.z + victim.position.z) * 0.5;
}

export function resolveBullUppercutOutcome(state, side, body) {
  if (!body || body.userData.bullUpperResolved) return;
  body.userData.bullUpperResolved = true;
  if (!body.userData.bullUpperHit) {
    const k = spinKey(side);
    state[k] = Math.max(0, state[k] - C.BULL_UPPERCUT_MISS_SELF);
  }
}

export function initBullUppercut(body) {
  body.userData.bullUpperPhase = 'windup';
  body.userData.bullUpperPhaseT = 0;
  body.userData.bullUpperHit = false;
  body.userData.bullImpactFlash = false;
  delete body.userData.bullUpperResolved;
  setBodyCollisions(body, false);
}

export function clearBullUppercutMotion(body) {
  body.userData.flightLift = 0;
  body.userData.flightTilt = 0;
  body.userData.flightRoll = 0;
  body.userData.flightSquash = 1;
  body.userData.bullUpperSlamming = false;
  body.userData.bullImpactFlash = false;
  delete body.userData.bullUpperPhase;
  delete body.userData.bullUpperPhaseT;
  delete body.userData.bullUpperHit;
  delete body.userData.bullUpperResolved;
  delete body.userData.bullChargeFromX;
  delete body.userData.bullChargeFromZ;
  delete body.userData.bullImpactX;
  delete body.userData.bullImpactZ;
  delete body.userData.bullImpactResolved;
  delete body.userData.bullImpactFromTilt;
  delete body.userData.bullImpactFromSquash;
  delete body.userData.bullRecoverFromTilt;
  delete body.userData.bullRecoverFromSquash;
  delete body.userData.bullCoastNx;
  delete body.userData.bullCoastNz;
  delete body.userData.bullCoastTargetX;
  delete body.userData.bullCoastTargetZ;
  delete body.userData.bullCoastDist;
  delete body.userData.bullDashDone;
  delete body.userData.bullWindupEndTilt;
}

export function releaseBullUppercutControl(body) {
  if (!body) return;
  body.userData.controlLocked = false;
  body.userData.airborne = false;
  clearBullUppercutMotion(body);
  setBodyCollisions(body, true);
  if (body.type === CANNON.Body.KINEMATIC) {
    restoreDynamicBody(body);
  }
  body.position.y = C.groundY(body);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
}

export function finishBullUppercut(state, side, slot, body, dt) {
  if (!body || (!slot.active && body.userData.bullUpperPhase == null)) return;
  resolveBullUppercutOutcome(state, side, body);
  slot.active = false;
  slot.activeRemaining = 0;
  slot.windupRemaining = 0;
  if (slot.ability.onEnd) slot.ability.onEnd(makeCtx(state, side, dt));
}

export function clearBullFlipCinematic(body) {
  if (!body) return;
  delete body.userData.bullFlipPhase;
  delete body.userData.bullFlipPhaseT;
  delete body.userData.bullFlipFalling;
  delete body.userData.bullFlipVY;
  delete body.userData.bullFlipWobbleT;
  delete body.userData.bullFlipPeakLift;
  delete body.userData.bullFlipFromX;
  delete body.userData.bullFlipFromZ;
  delete body.userData.bullFlipKbNx;
  delete body.userData.bullFlipKbNz;
  delete body.userData.bullFlipKbMag;
  delete body.userData.bullFlipElapsed;
  delete body.userData.bullUppercutFlipT;
  delete body.userData.bullFlipBurstT;
  body.userData.airborne = false;
}

export function releaseBullFlipVictim(body, applyKb = true) {
  if (!body) return;
  if (applyKb && (body.userData.bullFlipKbMag ?? 0) > 0) {
    applyPhysicsKnockback(
      body,
      body.userData.bullFlipKbNx ?? 0,
      body.userData.bullFlipKbNz ?? 0,
      body.userData.bullFlipKbMag * 0.2
    );
  }
  body.userData.controlLocked = false;
  body.userData.airborne = false;
  body.userData.flightLift = 0;
  body.userData.flightTilt = 0;
  body.userData.flightRoll = 0;
  body.userData.flightSquash = 1;
  clearBullFlipCinematic(body);
  setBodyCollisions(body, true);
  if (body.type === CANNON.Body.KINEMATIC) restoreDynamicBody(body);
  body.position.y = C.groundY(body);
}

export function pinBullFlipPhysics(body) {
  if (!body?.userData?.bullFlipPhase) return;
  if (body.type !== CANNON.Body.KINEMATIC) setAirborneKinematic(body);
  setBodyCollisions(body, false);
  body.velocity.set(0, 0, 0);
  body.angularVelocity.set(0, 0, 0);
  body.position.y = C.groundY(body);
}

export function tickBullFlipDecay(body, dt) {
  if (body.userData.bullFlipBurstT != null) {
    body.userData.bullFlipBurstT -= dt * 5;
    if (body.userData.bullFlipBurstT <= 0) delete body.userData.bullFlipBurstT;
  }

  if (!body.userData.bullFlipPhase) return;

  pinBullFlipPhysics(body);
  body.userData.airborne = true;
  body.userData.controlLocked = true;
  body.userData.bullFlipElapsed = (body.userData.bullFlipElapsed ?? 0) + dt;
  body.userData.bullFlipPhaseT = (body.userData.bullFlipPhaseT ?? 0) + dt;

  const peakLift = body.userData.bullFlipPeakLift ?? C.BULL_UPPERCUT_LIFT;

  if (!body.userData.bullFlipFalling) {
    const t = clamp01(body.userData.bullFlipPhaseT / C.BULL_AIR_RISE_DUR);
    const e = C.easeOutCubic(t);
    body.userData.flightLift = peakLift * Math.sin(e * Math.PI * 0.5);
    if (t >= 1) body.userData.bullFlipFalling = true;
  } else {
    let vy = body.userData.bullFlipVY ?? 0;
    vy -= C.BULL_AIR_GRAVITY * dt;
    let lift = (body.userData.flightLift ?? 0) + vy * dt;
    if (lift <= 0) {
      body.userData.flightLift = 0;
      body.userData.flightTilt = 0;
      body.userData.flightRoll = 0;
      body.userData.flightSquash = 1;
      releaseBullFlipVictim(body, true);
      return;
    }
    body.userData.bullFlipVY = vy;
    body.userData.flightLift = lift;
  }

  const lift = body.userData.flightLift ?? 0;
  const airFrac = clamp01(lift / Math.max(peakLift * 0.22, 0.5));
  const wobbleT = (body.userData.bullFlipWobbleT ?? 0) + dt;
  body.userData.bullFlipWobbleT = wobbleT;
  const amp = C.BULL_AIR_WOBBLE_AMP * airFrac;
  const wobbleWave = Math.sin(wobbleT * C.BULL_AIR_WOBBLE_RATE);
  const wobbleWave2 = Math.sin(wobbleT * C.BULL_AIR_WOBBLE_RATE * 0.83 + 0.6);
  body.userData.flightTilt = amp * wobbleWave;
  body.userData.flightRoll = amp * wobbleWave2;
  body.userData.flightSquash = 1 + 0.03 * airFrac * Math.sin(wobbleT * C.BULL_AIR_WOBBLE_RATE * 1.6);

  const kb = body.userData.bullFlipKbMag ?? 0;
  if (kb > 0) {
    const p = C.easeOutQuad(clamp01(body.userData.bullFlipElapsed / C.BULL_FLIP_DUR));
    const fromX = body.userData.bullFlipFromX ?? body.position.x;
    const fromZ = body.userData.bullFlipFromZ ?? body.position.z;
    const dist = kb * 0.32;
    body.position.x = fromX + (body.userData.bullFlipKbNx ?? 0) * dist * p;
    body.position.z = fromZ + (body.userData.bullFlipKbNz ?? 0) * dist * p;
  }
}

export function isLibraBusterChannelingBody(state, body) {
  if (!body) return false;
  if (body.userData.sonicBuster || body.userData.sonicBusterWindup) return true;
  for (const side of ['player', 'ai']) {
    if ((side === 'player' ? state.playerBody : state.aiBody) !== body) continue;
    const slot = state.abilities?.[side]?.special;
    if (slot?.ability?.id !== 'libra_sonic_buster') return false;
    return slot.windupRemaining > 0 || slot.active;
  }
  return false;
}

/** Pins Libra at stadium center while Sonic Buster windup/active (physics rate). */
export function stepLibraBusterChannel(state, dt) {
  for (const side of ['player', 'ai']) {
    const body = side === 'player' ? state.playerBody : state.aiBody;
    if (!isLibraBusterChannelingBody(state, body)) continue;

    const slot = state.abilities[side].special;
    const windup = C.slotWindupTotal(slot, C.LIBRA_BUSTER_WINDUP_DUR);
    let t = 1;
    if (slot.windupRemaining > 0) {
      t = C.easeOutCubic(1 - slot.windupRemaining / windup);
    }
    const fx = body.userData.sonicBusterFromX ?? body.position.x;
    const fz = body.userData.sonicBusterFromZ ?? body.position.z;
    body.position.x = fx + (0 - fx) * t;
    body.position.z = fz + (0 - fz) * t;
    body.velocity.set(0, 0, 0);
    body.userData.sonicBusterX = 0;
    body.userData.sonicBusterZ = 0;
  }
}
