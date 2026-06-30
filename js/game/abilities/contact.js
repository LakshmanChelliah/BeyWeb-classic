import { CONFIG } from '../../config.js';
import * as CANNON from 'cannon-es';
import { setBodyCollisions } from '../../physics/top.js';
import * as shared from './shared.js';
import * as C from './constants.js';

function applyGuard(impact, guardBody, guardTag, attackerTag) {
  if (!guardBody.userData.guarding) return;
  impact['impulse' + attackerTag] *= C.GUARD_IMPULSE_MULT;
  impact['impulse' + guardTag] *= C.GUARD_SELF_IMPULSE;
  impact['spinDelta' + attackerTag] *= C.GUARD_SPIN_MULT; // more negative = bigger loss
  impact['spinDelta' + guardTag] = 0; // guard takes no spin loss
  if (guardBody.userData.invulnerable) {
    guardBody.userData.flightRepulseT = 1;
  }
  if (guardBody.userData.sonicShield) {
    guardBody.userData.sonicShieldBurstT = 1;
  }
}

function applyStarBlastSlam(impact, slamBody, slamTag, victimTag) {
  if (!slamBody.userData.slamming) return false;
  const phase = slamBody.userData.starPhase;
  if (phase !== 'dive' && phase !== 'bounce') return false;

  if (!slamBody.userData.starBlastHit) {
    slamBody.userData.starBlastHit = true;
    impact['spinDelta' + victimTag] = -C.STAR_BLAST_HIT_SPIN;
  } else {
    impact['spinDelta' + victimTag] = 0;
  }
  impact['spinDelta' + slamTag] *= 0.15;
  impact['impulse' + victimTag] = Math.max(
    impact['impulse' + victimTag] * C.STAR_BLAST_IMPULSE_MULT,
    9.5
  );
  impact['impulse' + slamTag] *= C.SLAM_SELF_IMPULSE;
  return true;
}

function applyBullUppercutSlam(state, impact, slamBody, slamTag, victimTag) {
  if (!slamBody?.userData?.bullUpperSlamming) return false;
  const victim = impact['body' + victimTag];
  if (victim?.userData?.bullFlipPhase) {
    impact['impulse' + slamTag] *= C.SLAM_SELF_IMPULSE;
    return true;
  }
  if (shared.bullUppercutVictimImmune(state, slamBody, victim)) {
    impact['impulse' + slamTag] *= C.SLAM_SELF_IMPULSE;
    return true;
  }
  impact['impulse' + victimTag] = Math.max(
    impact['impulse' + victimTag] * C.BULL_UPPERCUT_SLAM_MULT,
    2.2
  );
  impact['impulse' + slamTag] *= C.SLAM_SELF_IMPULSE;
  impact['spinDelta' + victimTag] = Math.min(
    impact['spinDelta' + victimTag],
    -shared.bullUppercutSpinLoss(victim)
  );
  return true;
}

function applyEagleDiveSlam(impact, slamBody, slamTag, victimTag) {
  if (!slamBody?.userData?.eagleDiveSlamming) return false;
  if (!slamBody.userData.eagleDiveHit) {
    slamBody.userData.eagleDiveHit = true;
    impact['spinDelta' + victimTag] = Math.min(impact['spinDelta' + victimTag], -C.EAGLE_DIVE_HIT_SPIN);
  } else {
    impact['spinDelta' + victimTag] = Math.min(impact['spinDelta' + victimTag], 0);
  }
  impact['spinDelta' + slamTag] *= 0.18;
  impact['impulse' + victimTag] = Math.max(
    impact['impulse' + victimTag] * C.EAGLE_DIVE_IMPULSE_MULT,
    C.EAGLE_DIVE_MIN_IMPULSE
  );
  impact['impulse' + slamTag] *= C.SLAM_SELF_IMPULSE;
  slamBody.userData.eagleImpactFlash = true;
  return true;
}

function applySlam(impact, slamBody, slamTag, victimTag, state) {
  if (applyStarBlastSlam(impact, slamBody, slamTag, victimTag)) return;
  if (applyBullUppercutSlam(state, impact, slamBody, slamTag, victimTag)) return;
  if (applyEagleDiveSlam(impact, slamBody, slamTag, victimTag)) return;
  if (!slamBody.userData.slamming) return;
  impact['impulse' + victimTag] *= C.SLAM_IMPULSE_MULT;
  impact['impulse' + slamTag] *= C.SLAM_SELF_IMPULSE;
  impact['spinDelta' + victimTag] *= C.SLAM_SPIN_MULT;
}

function isSpinStealActive(state, side, body) {
  const power = state.abilities?.[side]?.power;
  return (
    power?.active &&
    power.ability?.id === 'ldrago_spin_steal' &&
    body?.userData.spinStealing
  );
}

function trySteal(state, impact, selfTag, oppTag) {
  if (!isSpinStealActive(state, impact['side' + selfTag], impact['body' + selfTag])) return;

  const oppDelta = impact['spinDelta' + oppTag];
  const oppLoss = Math.max(0, -oppDelta);
  if (oppLoss <= 0) return;

  // No spin loss for L-Drago — absorb whatever the opponent lost on this hit.
  impact['spinDelta' + selfTag] = Math.max(0, impact['spinDelta' + selfTag]) + oppLoss;

  const stealBody = impact['body' + selfTag];
  const oppBody = impact['body' + oppTag];
  stealBody.userData.spinStealBurstT = clamp01(oppLoss * 10);
  stealBody.userData.spinStealFromX = oppBody.position.x;
  stealBody.userData.spinStealFromZ = oppBody.position.z;
}

/** While Spin Steal is up, soften every collision L-Drago is in by 60%. */
function applySpinStealKnockback(state, impact) {
  for (const tag of ['A', 'B']) {
    if (!isSpinStealActive(state, impact['side' + tag], impact['body' + tag])) continue;
    impact.impulseA *= C.SPIN_STEAL_KB_MULT;
    impact.impulseB *= C.SPIN_STEAL_KB_MULT;
    return;
  }
}

/** Blocks spin loss (negative deltas) while a body is invulnerable (Soaring Destruction). */
function applyInvulnerability(impact) {
  for (const tag of ['A', 'B']) {
    const body = impact['body' + tag];
    if (!body?.userData?.invulnerable) continue;
    const delta = impact['spinDelta' + tag];
    if (delta < 0) impact['spinDelta' + tag] = 0;
  }
}

function applyBullStampede(impact, body, selfTag, oppTag) {
  if (!body?.userData?.stampeding) return;
  impact['impulse' + oppTag] *= C.BULL_STAMPEDE_KB_OUT;
}

function applyEagleCounter(impact, body, selfTag, oppTag) {
  if (!body?.userData?.counterStance) return;
  const oppBody = impact['body' + oppTag];
  const foeInMove = isBodyInSpecialMove(oppBody) || impact['closingSpeed'] > 3.4;
  if (!foeInMove) return;

  impact['impulse' + oppTag] = Math.max(
    impact['impulse' + oppTag] * C.EAGLE_COUNTER_KB_MULT,
    4.6
  );
  impact['impulse' + selfTag] *= C.EAGLE_COUNTER_SELF_MULT;
  impact['spinDelta' + oppTag] = Math.min(
    impact['spinDelta' + oppTag] * C.EAGLE_COUNTER_SPIN_MULT,
    -0.055
  );
  const selfDelta = impact['spinDelta' + selfTag];
  if (selfDelta < 0) impact['spinDelta' + selfTag] = selfDelta * 0.1;
  body.userData.eagleCounterFlashT = 1;
  if (oppBody) {
    body.userData.eagleCounterFromX = oppBody.position.x;
    body.userData.eagleCounterFromZ = oppBody.position.z;
  }
}

function applyLeoneAnchor(impact, body, selfTag, oppTag) {
  if (!body?.userData?.anchoring) return;
  impact['impulse' + selfTag] *= C.LEONE_ANCHOR_DAMAGE_TAKEN;
  impact['impulse' + oppTag] *= C.LEONE_ANCHOR_KB_OUT;
  const delta = impact['spinDelta' + selfTag];
  if (delta < 0) impact['spinDelta' + selfTag] = 0;
}

function applyLeoneSpinResist(impact) {
  for (const tag of ['A', 'B']) {
    const body = impact['body' + tag];
    if (body?.userData?.beyStats?.id !== 'leone') continue;
    const delta = impact['spinDelta' + tag];
    if (delta < 0) impact['spinDelta' + tag] = delta * C.LEONE_SPIN_LOSS_TAKEN;
  }
}

/** Sonic Buster — Libra takes only 10% of bey-vs-bey knockback and spin loss. */
function applyLibraBusterMitigation(state, impact) {
  for (const tag of ['A', 'B']) {
    const body = impact['body' + tag];
    if (!shared.isLibraBusterChannelingBody(state, body)) continue;
    impact['impulse' + tag] *= C.LIBRA_BUSTER_DAMAGE_TAKEN;
    const delta = impact['spinDelta' + tag];
    if (delta < 0) impact['spinDelta' + tag] = delta * C.LIBRA_BUSTER_DAMAGE_TAKEN;
  }
}

/**
 * Mutates a base impact object in place to apply ability effects.
 * impact = { bodyA, bodyB, sideA, sideB, closingSpeed,
 *            impulseA, impulseB,        // scalar magnitudes along the normal
 *            spinDeltaA, spinDeltaB }   // negative = spin lost by that side
 */
export function resolveContactAbilities(state, impact) {
  applyGuard(impact, impact.bodyA, 'A', 'B');
  applyGuard(impact, impact.bodyB, 'B', 'A');
  applySlam(impact, impact.bodyA, 'A', 'B', state);
  applySlam(impact, impact.bodyB, 'B', 'A', state);
  trySteal(state, impact, 'A', 'B');
  trySteal(state, impact, 'B', 'A');
  applySpinStealKnockback(state, impact);
  applyInvulnerability(impact);
  // Run last so slams/guards can't re-apply knockback to an anchored Leone.
  applyLeoneAnchor(impact, impact.bodyA, 'A', 'B');
  applyLeoneAnchor(impact, impact.bodyB, 'B', 'A');
  applyBullStampede(impact, impact.bodyA, 'A', 'B');
  applyBullStampede(impact, impact.bodyB, 'B', 'A');
  applyEagleCounter(impact, impact.bodyA, 'A', 'B');
  applyEagleCounter(impact, impact.bodyB, 'B', 'A');
  applyLibraBusterMitigation(state, impact);
  applyLeoneSpinResist(impact);
}

export { isLibraBusterChannelingBody } from './shared.js';

/** True while a bey is executing an active special / power move. */
export function isBodyInSpecialMove(body, state) {
  if (!body?.userData) return false;
  const ud = body.userData;
  return !!(
    ud.slamming ||
    ud.airborne ||
    ud.stampeding ||
    ud.counterStance ||
    ud.eagleDivePhase != null ||
    ud.eagleDiveSlamming ||
    ud.bullUpperSlamming ||
    ud.strikerSlamming ||
    ud.strikerFlashPhase != null ||
    ud.boosting ||
    ud.spinStealing ||
    ud.guarding ||
    ud.anchoring ||
    ud.lionWall ||
    ud.starPhase != null ||
    (state && shared.isLibraBusterChannelingBody(state, body))
  );
}

function contactLift(body) {
  return shared.readContactLift(body);
}

function isAerialStriker(body) {
  if (!body) return false;
  if (body.userData.bullUpperSlamming) return true;
  if (body.userData.strikerSlamming) return true;
  if (body.userData.eagleDiveSlamming) return true;
  if (!body.userData.slamming) return false;
  const phase = body.userData.starPhase;
  return phase === 'dive' || phase === 'bounce';
}

/** True when two tops are close enough vertically for bey-vs-bey contact. */
export function canTopsContactVertically(bodyA, bodyB) {
  if (!bodyA || !bodyB) return true;
  let liftA = contactLift(bodyA);
  let liftB = contactLift(bodyB);
  // Dive slams reach down to the target's elevation.
  if (isAerialStriker(bodyA)) liftA = Math.min(liftA, liftB);
  if (isAerialStriker(bodyB)) liftB = Math.min(liftB, liftA);
  const rA = bodyA.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const rB = bodyB.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  const reach = (rA + rB) * 0.78;
  return Math.abs(liftA - liftB) <= reach;
}

/** Clears all per-body ability flags (used on spawn / round reset). */
export function clearAbilityFlags(body) {
  if (!body) return;
  body.userData.steerMult = 1;
  body.userData.controlLocked = false;
  body.userData.airborne = false;
  body.userData.boosting = false;
  body.userData.slamming = false;
  body.userData.guarding = false;
  body.userData.anchoring = false;
  body.userData.lionWall = false;
  body.userData.sonicShield = false;
  body.userData.sonicBuster = false;
  body.userData.sonicSandBoost = false;
  body.userData.spinStealing = false;
  body.userData.stampeding = false;
  body.userData.counterStance = false;
  body.userData.invulnerable = false;
  body.userData.flightLift = 0;
  body.userData.flightTilt = 0;
  body.userData.flightRoll = 0;
  body.userData.flightSquash = 1;
  delete body.userData.contactLift;
  delete body.userData.starBlastWindup;
  delete body.userData.starPhase;
  delete body.userData.starPhaseT;
  delete body.userData.starImpactFlash;
  delete body.userData.starBlastHit;
  delete body.userData.starBlastResolved;
  delete body.userData.starWallX;
  delete body.userData.starWallZ;
  delete body.userData.lionWallPulse;
  delete body.userData.leoneAnchorT;
  delete body.userData.lionWallT;
  delete body.userData.lionWallBurstT;
  delete body.userData.lionWallReach;
  delete body.userData.sonicShieldPulse;
  delete body.userData.sonicShieldT;
  delete body.userData.sonicShieldBurstT;
  delete body.userData.sonicShieldReach;
  delete body.userData.sonicBusterT;
  delete body.userData.sonicBusterX;
  delete body.userData.sonicBusterZ;
  delete body.userData.sonicBusterReach;
  delete body.userData.sonicBusterSpread;
  delete body.userData._sonicSandBaseSteer;
  delete body.userData.boostT;
  delete body.userData.spinStealT;
  delete body.userData.spinStealBurstT;
  delete body.userData.spinStealFromX;
  delete body.userData.spinStealFromZ;
  delete body.userData.stampedeT;
  delete body.userData.eagleCounterT;
  delete body.userData.eagleCounterFlashT;
  delete body.userData.eagleCounterFromX;
  delete body.userData.eagleCounterFromZ;
  body.userData.eagleDiveWindup = false;
  shared.clearEagleDiveMotion(body);
  if (body.userData.bullFlipPhase) {
    shared.releaseBullFlipVictim(body, false);
  }
  delete body.userData.bullUpperSlamming;
  delete body.userData.bullImpactFlash;
  delete body.userData.bullImpactFlashT;
  shared.clearBullUppercutMotion(body);
  shared.releaseStrikerFlashControl(body);
  delete body.userData.ldragoFlightT;
  delete body.userData.ldragoFlightLaunchT;
  delete body.userData.flightRepulseT;
  delete body.userData.ldragoLightningSpots;
  delete body.userData.ldragoLightningFired;
  delete body.userData.ldragoUpperMode;
  delete body.userData.atkCombatMultMult;
  delete body.userData.ldragoAbsorbPhase;
  delete body.userData.ldragoAbsorbPhaseT;
  delete body.userData.ldragoAbsorbWindup;
  delete body.userData.ldragoAbsorbRush;
  delete body.userData.ldragoAbsorbImpact;
  body.userData.lionWallWindup = false;
  body.userData.ldragoFlightWindup = false;
  body.userData.sonicBusterWindup = false;
  shared.clearSonicSlow(body);
  shared.clearLibraSandBoost(body);
  shared.clearLibraBusterVibrate(body);
  if (body.type === CANNON.Body.KINEMATIC) {
    shared.restoreDynamicBody(body);
  }
  setBodyCollisions(body, true);
}

