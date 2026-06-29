import * as CANNON from 'cannon-es';
import { CONFIG } from '../config.js';
import { applySteerForce, computeSteerForce } from '../physics/steer.js';
import { isAtPocketAngle } from '../physics/arena.js';

const _force = new CANNON.Vec3();

/**
 * Per-tier tuning — tier index 0 is easiest.
 * Player archetypes: Beginner → Bot.
 *
 * outAvoidance — how hard they fight ring-outs (low = rim suicide, high = pro survival)
 * edgeSkill    — how early they read rim / pocket danger
 * mistakeRate  — wrong steer choices (suppressed near the rim when outAvoidance is high)
 */
const AI_TIERS = [
  { forceMult: 0.72, decisionInterval: 0.42, specialReach: 2.8, powerReach: 4.2, leadSkill: 0.0,  edgeSkill: 0.10, outAvoidance: 0.06, mistakeRate: 0.42, abilityDiscipline: 0.30 },
  { forceMult: 0.86, decisionInterval: 0.32, specialReach: 3.6, powerReach: 5.4, leadSkill: 0.10, edgeSkill: 0.22, outAvoidance: 0.16, mistakeRate: 0.30, abilityDiscipline: 0.46 },
  { forceMult: 1.00, decisionInterval: 0.24, specialReach: 4.8, powerReach: 6.8, leadSkill: 0.30, edgeSkill: 0.40, outAvoidance: 0.34, mistakeRate: 0.18, abilityDiscipline: 0.64 },
  { forceMult: 1.12, decisionInterval: 0.18, specialReach: 5.8, powerReach: 8.2, leadSkill: 0.50, edgeSkill: 0.58, outAvoidance: 0.54, mistakeRate: 0.10, abilityDiscipline: 0.78 },
  { forceMult: 1.26, decisionInterval: 0.13, specialReach: 7.0, powerReach: 9.8, leadSkill: 0.74, edgeSkill: 0.82, outAvoidance: 0.80, mistakeRate: 0.05, abilityDiscipline: 0.90 },
  { forceMult: 1.38, decisionInterval: 0.10, specialReach: 7.8, powerReach: 10.8, leadSkill: 0.88, edgeSkill: 0.94, outAvoidance: 0.92, mistakeRate: 0.03, abilityDiscipline: 0.95 },
  { forceMult: 1.44, decisionInterval: 0.08, specialReach: 8.4, powerReach: 11.4, leadSkill: 0.94, edgeSkill: 1.00, outAvoidance: 0.98, mistakeRate: 0.01, abilityDiscipline: 0.98 },
];

export const AI_TIER_MAX = AI_TIERS.length - 1;

export const AI_DIFFICULTIES = Object.freeze([
  { tier: 0, label: 'Beginner' },
  { tier: 1, label: 'Amateur' },
  { tier: 2, label: 'Intermediate' },
  { tier: 3, label: 'Advanced' },
  { tier: 4, label: 'Pro' },
  { tier: 5, label: 'Master' },
  { tier: 6, label: 'Bot' },
]);

export function getDifficultyLabel(tier) {
  return AI_DIFFICULTIES[Math.max(0, Math.min(tier, AI_TIER_MAX))]?.label ?? 'Amateur';
}

let _tier = 1;
let _tournament = false;
let _stageIndex = 0;
let _opponentId = null;
let _steerDecisionT = 0;
let _abilityDecisionT = 0;
let _steerMode = 'chase';
let _orbitDir = 1;

const TOURNAMENT_BOSS_OVERRIDES = {
  leone: { powerReach: 8.5, outAvoidance: 0.82, interceptBias: true },
  pegasus: { abilityDiscipline: 0.96, specialReach: 8.0, decisionInterval: 0.08 },
  ldrago: { abilityDiscipline: 1.0, specialReach: 9.0, decisionInterval: 0.06, mistakeRate: 0.01, outAvoidance: 0.95, forceMult: 1.50 }
};

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

function tierConfig() {
  return AI_TIERS[Math.min(_tier, AI_TIERS.length - 1)] ?? AI_TIERS[1];
}

/** Tournament opponents think one tier sharper without raw force spike. */
function decisionTier() {
  const bonus = (_tournament && _stageIndex <= 3) ? 1 : 0;
  return Math.min(_tier + bonus, AI_TIER_MAX);
}

function decisionConfig() {
  const base = AI_TIERS[decisionTier()] ?? AI_TIERS[AI_TIER_MAX];
  if (!_tournament) return base;
  
  const stageFrac = Math.min(1, Math.max(0, _stageIndex / 5));
  const outAvoidance = 0.58 + stageFrac * 0.30;
  const edgeSkill = 0.48 + stageFrac * 0.27;
  const abilityDiscipline = 0.68 + stageFrac * 0.24;
  const mistakeMult = 0.45 - stageFrac * 0.30;
  const leadSkillBonus = 0.08 + stageFrac * 0.10;
  const decisionMult = 0.95 - stageFrac * 0.20;
  const forceBoost = stageFrac * 0.12;

  let conf = {
    ...base,
    outAvoidance: Math.max(base.outAvoidance, outAvoidance),
    edgeSkill: Math.max(base.edgeSkill, edgeSkill),
    abilityDiscipline: Math.max(base.abilityDiscipline, abilityDiscipline),
    mistakeRate: base.mistakeRate * mistakeMult,
    leadSkill: Math.min(1, base.leadSkill + leadSkillBonus),
    decisionInterval: base.decisionInterval * decisionMult,
    forceMult: base.forceMult + forceBoost,
  };

  const override = TOURNAMENT_BOSS_OVERRIDES[_opponentId];
  if (override) {
    conf = { ...conf, ...override };
  }

  return conf;
}

function edgeFracForBody(body) {
  const cr = Math.hypot(body.position.x, body.position.z);
  const outerR = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
  return (cr + outerR * 0.45) / CONFIG.WALL_RADIUS;
}

function isNearPocket(body, toleranceMult = 1.35) {
  const cr = Math.hypot(body.position.x, body.position.z);
  if (cr < 0.01) return false;
  return isAtPocketAngle(Math.atan2(body.position.z, body.position.x), toleranceMult);
}

function analyzeBey(beyStats) {
  const move = beyStats?.move ?? beyStats?.atk ?? 50;
  const def = beyStats?.def ?? 50;
  const sta = beyStats?.sta ?? 50;
  return {
    move,
    def,
    sta,
    /** Attack / speed types chase harder — edge safety scales up to match their velocity. */
    aggression: clamp01((move - 38) / 58),
    caution: clamp01((def - 28) / 68),
    patience: clamp01((sta - 28) / 68),
  };
}

function canTriggerSlot(slot, spin) {
  if (!slot?.ability) return false;
  return (
    slot.cooldownRemaining <= 0 &&
    !slot.active &&
    slot.windupRemaining <= 0 &&
    spin >= CONFIG.SLEEP_THRESHOLD
  );
}

export function setAIDifficulty(tier) {
  _tier = Math.max(0, Math.min(tier, AI_TIERS.length - 1));
}

export function setAIContext({ tournament = false } = {}) {
  _tournament = Boolean(tournament);
}

export function resetAIController() {
  _steerDecisionT = 0;
  _abilityDecisionT = 0;
  _steerMode = 'chase';
  _orbitDir = Math.random() < 0.5 ? -1 : 1;
}

function rimBailEdgeFrac() {
  const { edgeSkill, outAvoidance } = decisionConfig();
  // Casual players react late; pros / bots read the rim early.
  return 0.82 - outAvoidance * 0.24 - edgeSkill * 0.06;
}

function isRimDanger(aiBody) {
  const edgeFrac = edgeFracForBody(aiBody);
  return edgeFrac > 0.50 || (edgeFrac > 0.52 && isNearPocket(aiBody));
}

function naiveSteerMode(persona, rimDanger) {
  if (rimDanger) return 'chase';
  if (persona.patience > 0.55 && Math.random() < 0.45) return 'center';
  return 'chase';
}

function pickIdealSteerMode(persona, dist, spin, playerSpin, aiBody) {
  const skill = decisionTier() / AI_TIER_MAX;
  const { outAvoidance } = decisionConfig();
  const edgeFrac = edgeFracForBody(aiBody);
  const inPocket = edgeFrac > 0.54 && isNearPocket(aiBody);
  const bailAt = rimBailEdgeFrac();
  const rimPlay = outAvoidance >= 0.75;

  if (inPocket) {
    if (outAvoidance < 0.28) return Math.random() < 0.75 ? 'chase' : 'center';
    if (outAvoidance < 0.55) return Math.random() < 0.55 ? 'chase' : 'center';
    return 'center';
  }

  if (edgeFrac > bailAt) {
    if (outAvoidance < 0.32) return 'chase';
    if (outAvoidance < 0.58) return Math.random() < 0.5 ? 'center' : 'chase';
    return 'center';
  }

  if (edgeFrac > bailAt - 0.09) {
    if (outAvoidance < 0.45) return 'chase';
    if (rimPlay) return dist < 3.2 && spin > 0.30 ? 'intercept' : 'center';
    return dist < 3.0 && spin > 0.32 ? 'intercept' : 'center';
  }

  if (persona.aggression > 0.55) {
    if (edgeFrac > 0.52 && rimPlay) return 'center';
    if (edgeFrac > 0.52) return dist < 3.5 && skill > 0.28 ? 'intercept' : 'center';
    return skill > 0.45 ? 'intercept' : 'chase';
  }

  if (persona.patience > 0.55) {
    if (dist > 6.5 && spin > 0.28) return skill > 0.40 ? 'orbit' : 'center';
    if (dist < 4.5 && playerSpin < spin + 0.08) return 'chase';
    return dist > 5 ? 'center' : 'chase';
  }

  if (persona.caution > 0.55 || decisionConfig().interceptBias) {
    if (dist > 6.5) return 'center';
    if (dist < 3.8 && spin > 0.25) return 'chase';
    return skill > 0.50 ? 'intercept' : 'center';
  }

  return skill > 0.42 ? 'intercept' : 'chase';
}

function pickSteerMode(persona, dist, spin, playerSpin, aiBody) {
  const ideal = pickIdealSteerMode(persona, dist, spin, playerSpin, aiBody);
  const { mistakeRate, outAvoidance } = decisionConfig();
  const rimDanger = isRimDanger(aiBody);
  let slipChance = mistakeRate;
  if (rimDanger) slipChance *= 1 - outAvoidance * 0.94;
  if (Math.random() < slipChance) return naiveSteerMode(persona, rimDanger);
  return ideal;
}

function computeChaseDir(aiBody, playerBody, leadSkill) {
  const ax = aiBody.position.x;
  const az = aiBody.position.z;
  const px = playerBody.position.x;
  const pz = playerBody.position.z;
  let tx = px;
  let tz = pz;

  if (leadSkill > 0.05) {
    const leadT = 0.14 + leadSkill * 0.32;
    tx += playerBody.velocity.x * leadT;
    tz += playerBody.velocity.z * leadT;
  }

  return { dx: tx - ax, dz: tz - az };
}

/** Blend chase toward center when rim-riding — strength scales with player archetype. */
function blendEdgeSafeDir(aiBody, dx, dz, persona) {
  const ax = aiBody.position.x;
  const az = aiBody.position.z;
  const cr = Math.hypot(ax, az);
  if (cr < 0.01) return { dx, dz };

  const edgeFrac = edgeFracForBody(aiBody);
  if (edgeFrac < 0.48) return { dx, dz };

  const { edgeSkill, outAvoidance } = decisionConfig();
  const inPocket = edgeFrac > 0.54 && isNearPocket(aiBody);
  const edgeT = clamp01((edgeFrac - 0.48) / 0.32);

  let centerBlend = edgeT * outAvoidance * (0.48 + edgeSkill * 0.42);
  if (persona.aggression > 0.5 && outAvoidance > 0.7) {
    centerBlend += edgeT * outAvoidance * persona.aggression * 0.14;
  } else if (persona.aggression > 0.5) {
    centerBlend += edgeT * persona.aggression * 0.08;
  }
  if (inPocket) {
    centerBlend = Math.max(centerBlend, outAvoidance * (0.50 + edgeSkill * 0.38));
  }
  if (outAvoidance < 0.25) centerBlend *= 0.35;
  centerBlend = clamp01(centerBlend);

  const cx = (-ax / cr);
  const cz = (-az / cr);
  return {
    dx: dx * (1 - centerBlend) + cx * centerBlend,
    dz: dz * (1 - centerBlend) + cz * centerBlend,
  };
}

/** Low-skill CPUs wobble their aim; pros stay sharp near the rim. */
function applyAimNoise(dx, dz, persona, aiBody) {
  const { mistakeRate, leadSkill, outAvoidance } = decisionConfig();
  const rimDanger = isRimDanger(aiBody);
  let noise = mistakeRate * (0.55 - leadSkill * 0.35);
  if (rimDanger) noise *= 1 - outAvoidance * 0.88;
  if (noise < 0.02) return { dx, dz };
  const angle = (Math.random() - 0.5) * Math.PI * noise * (1.1 + persona.aggression * 0.4);
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { dx: dx * c - dz * s, dz: dx * s + dz * c };
}

function computeSteerDir(aiBody, playerBody, persona) {
  const { leadSkill } = decisionConfig();
  const ax = aiBody.position.x;
  const az = aiBody.position.z;
  const cr = Math.hypot(ax, az) || 1;
  const dist = Math.hypot(
    playerBody.position.x - ax,
    playerBody.position.z - az
  );

  let dx;
  let dz;

  if (_steerMode === 'center') {
    const edgeFrac = edgeFracForBody(aiBody);
    const { outAvoidance } = decisionConfig();
    const onRim = edgeFrac > 0.52;
    const rescueBias = onRim ? 0.30 + outAvoidance * 0.68 : 1;
    const centerWeight = (0.56 + persona.caution * 0.22) * rescueBias;
    const chase = computeChaseDir(aiBody, playerBody, leadSkill * 0.25);
    if (dist < 3.2 && edgeFrac < 0.56 && outAvoidance < 0.7) {
      ({ dx, dz } = chase);
    } else {
      dx = -ax * centerWeight + chase.dx * (1 - centerWeight);
      dz = -az * centerWeight + chase.dz * (1 - centerWeight);
    }
  } else if (_steerMode === 'orbit') {
    const tangX = (-az / cr) * _orbitDir;
    const tangZ = (ax / cr) * _orbitDir;
    const pull = 0.22 + persona.patience * 0.24;
    if (dist < 4) {
      const chase = computeChaseDir(aiBody, playerBody, leadSkill * 0.5);
      dx = chase.dx * 0.6 + tangX * 0.4;
      dz = chase.dz * 0.6 + tangZ * 0.4;
    } else {
      dx = tangX + (-ax / cr) * pull;
      dz = tangZ + (-az / cr) * pull;
    }
  } else if (_steerMode === 'intercept') {
    ({ dx, dz } = computeChaseDir(aiBody, playerBody, leadSkill));
  } else {
    ({ dx, dz } = computeChaseDir(aiBody, playerBody, leadSkill * 0.2));
  }

  ({ dx, dz } = applyAimNoise(dx, dz, persona, aiBody));
  return blendEdgeSafeDir(aiBody, dx, dz, persona);
}

function applyEdgeSafety(aiBody, spin, aiForce, persona) {
  const ax = aiBody.position.x;
  const az = aiBody.position.z;
  const cr = Math.hypot(ax, az);
  if (cr < 0.01) return;

  const edgeFrac = edgeFracForBody(aiBody);
  if (edgeFrac < 0.50) return;

  const { edgeSkill, outAvoidance } = decisionConfig();
  if (outAvoidance < 0.12) return;

  const inPocket = edgeFrac > 0.54 && isNearPocket(aiBody);
  const basePull = (0.22 + persona.caution * 0.30 + edgeSkill * 0.28) * outAvoidance;
  const speedComp = persona.aggression * edgeSkill * 0.14 * outAvoidance;
  const pocketUrgency = inPocket ? 1.15 + outAvoidance * 0.65 : 1;
  const edgeT = clamp01((edgeFrac - 0.50) / 0.34);
  const pull = edgeT * (basePull + speedComp) * pocketUrgency;

  const force = computeSteerForce(aiBody, spin, aiForce);
  _force.set((-ax / cr) * force * pull, 0, (-az / cr) * force * pull);
  aiBody.applyForce(_force, aiBody.position);

  if (inPocket && outAvoidance >= 0.72) {
    const escape = outAvoidance * (0.22 + edgeSkill * 0.38 + persona.aggression * 0.12);
    const tangX = -az / cr;
    const tangZ = ax / cr;
    const pocketBias = isNearPocket(aiBody, 1.05) ? _orbitDir : -_orbitDir;
    _force.set(tangX * force * escape * 0.72 * pocketBias, 0, tangZ * force * escape * 0.72 * pocketBias);
    aiBody.applyForce(_force, aiBody.position);
  } else if (edgeFrac > 0.64 && outAvoidance >= 0.55) {
    const escape = outAvoidance * (0.12 + edgeSkill * 0.18);
    const tangX = -az / cr;
    const tangZ = ax / cr;
    _force.set(tangX * force * escape * 0.5 * _orbitDir, 0, tangZ * force * escape * 0.5 * _orbitDir);
    aiBody.applyForce(_force, aiBody.position);
  }
}

function tickSteerDecisions(aiBody, playerBody, spin, playerSpin) {
  const { decisionInterval } = decisionConfig();
  _steerDecisionT -= CONFIG.FIXED_DT;
  if (_steerDecisionT > 0) return;
  _steerDecisionT = decisionInterval * (0.9 + Math.random() * 0.18);

  const persona = analyzeBey(aiBody.userData.beyStats);
  const dist = Math.hypot(
    playerBody.position.x - aiBody.position.x,
    playerBody.position.z - aiBody.position.z
  );
  _steerMode = pickSteerMode(persona, dist, spin, playerSpin, aiBody);

  if (_steerMode === 'orbit' && Math.random() < 0.14) {
    _orbitDir *= -1;
  }
}

/** Fast beys need less raw steer near the rim — physics move mult already makes them quick. */
function steerForceScale(persona, aiBody) {
  const edgeFrac = edgeFracForBody(aiBody);
  if (persona.aggression < 0.45) return 1;
  if (edgeFrac > 0.58) return 0.72 - persona.aggression * 0.08;
  if (edgeFrac > 0.48) return 0.88 - persona.aggression * 0.06;
  return 1;
}

export function applyAISteering(aiBody, playerBody, spin, playerSpin = 1) {
  if (!aiBody || !playerBody || spin < 0.05 || aiBody.userData.controlLocked) return;

  tickSteerDecisions(aiBody, playerBody, spin, playerSpin);

  const { forceMult } = tierConfig();
  const persona = analyzeBey(aiBody.userData.beyStats);
  const aiForce = CONFIG.AI_FORCE * forceMult * steerForceScale(persona, aiBody);
  const { dx, dz } = computeSteerDir(aiBody, playerBody, persona);

  applySteerForce(aiBody, dx, dz, spin, aiForce, { minSpin: 0.05 });
  applyEdgeSafety(aiBody, spin, CONFIG.AI_FORCE * forceMult, persona);
}

function shouldUseAbility(wants, aiRimDanger) {
  const { abilityDiscipline, mistakeRate } = decisionConfig();
  if (!wants) {
    // Beginners sometimes panic-move on the rim even when it is a bad idea.
    if (aiRimDanger && Math.random() < mistakeRate * 0.18) return true;
    return false;
  }
  return Math.random() < abilityDiscipline;
}

/** Periodically triggers CPU power/special when conditions are favorable. */
export function tickAIAbilities(state, onTrigger) {
  if (!state.abilities?.ai || state.launchGrace > 0 || !state.gameRunning || state.gameFrozen) {
    return;
  }
  if (CONFIG.ABILITY_TEST_NO_DELAYS) return;

  const { decisionInterval, specialReach, powerReach } = decisionConfig();

  _abilityDecisionT -= CONFIG.FIXED_DT;
  if (_abilityDecisionT > 0) return;
  _abilityDecisionT = decisionInterval;

  const spin = state.aiSpin;
  const aiBody = state.aiBody;
  const playerBody = state.playerBody;
  if (!aiBody || !playerBody || spin < CONFIG.SLEEP_THRESHOLD || aiBody.userData.controlLocked) {
    return;
  }

  const persona = analyzeBey(aiBody.userData.beyStats);
  const ax = aiBody.position.x;
  const az = aiBody.position.z;
  const dx = playerBody.position.x - ax;
  const dz = playerBody.position.z - az;
  const dist = Math.hypot(dx, dz);
  const playerSpin = state.playerSpin;
  const runtime = state.abilities.ai;
  const aiEdge = edgeFracForBody(aiBody);
  const playerEdge = edgeFracForBody(playerBody);
  const aiInPocket = aiEdge > 0.54 && isNearPocket(aiBody);
  const aiRimDanger = aiEdge > 0.56 || aiInPocket;
  const playerClosing =
    playerBody.velocity.x * dx + playerBody.velocity.z * dz > 0.8;

  const specialSlot = runtime.special;
  if (canTriggerSlot(specialSlot, spin)) {
    let useSpecial =
      (dist < specialReach && playerSpin < 0.42) ||
      dist < specialReach * 0.72 ||
      (dist < specialReach * 1.1 && spin > playerSpin + 0.1);

    if (persona.caution > 0.5 && dist < specialReach && playerClosing) {
      useSpecial = true;
    }
    if (persona.aggression > 0.5 && dist < specialReach * 1.15 && playerEdge > 0.58 && !aiRimDanger) {
      useSpecial = true;
    }
    if (persona.patience > 0.55 && dist < specialReach * 0.9 && spin > 0.35) {
      useSpecial = true;
    }
    if (aiBody.userData.beyStats?.id === 'bull' && aiEdge > 0.58 && dist < specialReach * 1.15 && !aiInPocket) {
      useSpecial = true;
    }

    if (useSpecial && aiInPocket) {
      useSpecial = false;
    }

    if (shouldUseAbility(useSpecial, aiRimDanger)) {
      onTrigger('special');
      return;
    }
  }

  const powerSlot = runtime.power;
  if (canTriggerSlot(powerSlot, spin)) {
    let usePower = dist < powerReach && dist > 1.4 && spin > 0.2 && !aiRimDanger;

    if (persona.aggression > 0.5 && dist < powerReach * 1.1 && dist > 1.2 && !aiRimDanger) {
      usePower = true;
    }
    if (persona.patience > 0.5 && dist < powerReach * 0.85 && playerClosing && !aiRimDanger) {
      usePower = true;
    }
    if (persona.caution > 0.5 && dist < powerReach * 0.75 && playerClosing && spin > 0.3) {
      usePower = true;
    }

    if (shouldUseAbility(usePower, aiRimDanger)) onTrigger('power');
  }
}
