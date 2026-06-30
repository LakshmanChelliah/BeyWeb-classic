import { CONFIG } from '../../config.js';
import * as shared from './shared.js';
import { spinKey } from './shared.js';
import * as C from './constants.js';
import { ABILITY_REGISTRY } from './registry/index.js';

export function makeSlot(id) {
  const ability = id ? ABILITY_REGISTRY[id] || null : null;
  if (!ability) return null;
  const initialCharge = CONFIG.ABILITY_TEST_NO_DELAYS
    ? 0
    : (ability.charge ?? ability.cooldown ?? 0);
  return {
    ability,
    cooldownRemaining: initialCharge,
    cooldownTotal: initialCharge,
    windupRemaining: 0,
    windupDuration: 0,
    active: false,
    activeRemaining: 0,
  };
}

export function createAbilityRuntime(bey) {
  const g = bey?.gimmicks || {};
  return {
    power: makeSlot(g.power),
    special: makeSlot(g.special),
    passive: g.passive ? ABILITY_REGISTRY[g.passive] || null : null,
  };
}

export function makeCtx(state, side, dt) {
  const isPlayer = side === 'player';
  const body = isPlayer ? state.playerBody : state.aiBody;
  const opponentBody = isPlayer ? state.aiBody : state.playerBody;
  return {
    state,
    side,
    oppSide: isPlayer ? 'ai' : 'player',
    body,
    opponentBody,
    dt,
    getSpin(s = side) {
      return state[spinKey(s)];
    },
    addSpin(delta, s = side) {
      if (delta < 0) {
        const b = s === 'player' ? state.playerBody : state.aiBody;
        if (b?.userData?.invulnerable) return;
      }
      const k = spinKey(s);
      state[k] = Math.max(0, Math.min(1, state[k] + delta));
    },
  };
}

export function activateSlot(state, side, slot) {
  const ability = slot.ability;
  slot.windupDuration = 0;
  slot.active = true;
  slot.activeRemaining = ability.duration || 0;
  if (ability.onActivate) ability.onActivate(makeCtx(state, side, 0));
  if (slot.activeRemaining <= 0) {
    if (ability.onEnd) ability.onEnd(makeCtx(state, side, 0));
    slot.active = false;
  }
}

function applyAbilityWindupSetup(state, side, ability) {
  const body = side === 'player' ? state.playerBody : state.aiBody;
  if (!body) return;
  if (ability.id === 'pegasus_star_blast') {
    body.userData.controlLocked = true;
    shared.initStarBlast(body);
  }
  if (ability.id === 'ldrago_soaring_destruction') {
    body.userData.invulnerable = true;
    body.userData.ldragoFlightWindup = true;
  }
  if (ability.id === 'ldrago_absorb_break') {
    body.userData.controlLocked = true;
    body.userData.ldragoAbsorbWindup = true;
    body.userData.ldragoAbsorbFromX = body.position.x;
    body.userData.ldragoAbsorbFromZ = body.position.z;
  }
  if (ability.id === 'leone_lion_wall') {
    body.userData.controlLocked = true;
    body.userData.lionWallWindup = true;
    body.userData.airborne = true;
  }
  if (ability.id === 'libra_sonic_buster') {
    body.userData.controlLocked = true;
    body.userData.sonicBusterWindup = true;
    body.userData.sonicBusterFromX = body.position.x;
    body.userData.sonicBusterFromZ = body.position.z;
    body.userData.sonicBusterX = 0;
    body.userData.sonicBusterZ = 0;
    body.userData.sonicBusterVibrateT = 0;
    body.velocity.set(0, 0, 0);
  }
  if (ability.id === 'bull_red_horn_uppercut') {
    body.userData.controlLocked = true;
    shared.initBullUppercut(body);
  }
  if (ability.id === 'striker_lightning_flash') {
    body.userData.controlLocked = true;
    body.userData.airborne = true;
    body.userData.invulnerable = true;
    body.userData.strikerFlashPhase = 'windup';
    body.userData.strikerFlashPhaseT = 0;
    shared.setAirborneKinematic(body);
    setBodyCollisions(body, false);
  }
  if (ability.id === 'eagle_diving_crush') {
    body.userData.controlLocked = true;
    body.userData.airborne = true;
    body.userData.invulnerable = true;
    body.userData.eagleDiveWindup = true;
    body.userData.flightLift = 0;
    body.userData.flightTilt = 0;
    body.userData.flightRoll = 0;
    body.userData.flightSquash = 1;
    body.velocity.set(0, 0, 0);
    setBodyCollisions(body, false);
  }
}

/**
 * Attempts to trigger a power/special slot for a side. Returns the ability that
 * fired (so the engine can play its flash) or null if it was unavailable.
 */
export function triggerAbility(state, side, slotName) {
  const runtime = state.abilities?.[side];
  if (!runtime) return null;
  const slot = runtime[slotName];
  if (!slot) return null;
  if (state[spinKey(side)] < CONFIG.SLEEP_THRESHOLD) return null;
  const testInstant = CONFIG.ABILITY_TEST_NO_DELAYS;
  if (
    (!testInstant && slot.cooldownRemaining > 0) ||
    slot.active ||
    slot.windupRemaining > 0
  ) {
    return null;
  }

  const ability = slot.ability;
  if (testInstant) {
    slot.cooldownRemaining = 0;
    slot.cooldownTotal = ability.cooldown || 0;
  } else {
    slot.cooldownRemaining = ability.cooldown || 0;
    slot.cooldownTotal = ability.cooldown || 0;
  }
  if ((ability.windup || 0) > 0) {
    applyAbilityWindupSetup(state, side, ability);
    if (testInstant) {
      activateSlot(state, side, slot);
    } else {
      slot.windupDuration = C.effectiveSpecialWindup(ability.windup);
      slot.windupRemaining = slot.windupDuration;
    }
  } else {
    activateSlot(state, side, slot);
  }
  return ability;
}

/** Ends one in-progress ability slot when the bey's spin has fully stopped. */
function cancelSlotOnSpinStop(state, side, slot, dt) {
  const body = side === 'player' ? state.playerBody : state.aiBody;
  const ability = slot?.ability;
  if (!ability) return false;
  if (slot.windupRemaining <= 0 && !slot.active) return false;

  const id = ability.id;
  if (id === 'pegasus_star_blast') {
    shared.finishStarBlast(state, side, slot, body, dt);
    return true;
  }
  if (id === 'bull_red_horn_uppercut') {
    shared.finishBullUppercut(state, side, slot, body, dt);
    return true;
  }
  if (id === 'striker_lightning_flash') {
    shared.finishStrikerFlash(state, side, slot, body, dt);
    return true;
  }
  if (id === 'ldrago_absorb_break') {
    shared.finishLdragoAbsorb(state, side, slot, body, dt);
    return true;
  }
  if (id === 'eagle_diving_crush') {
    shared.finishEagleDive(state, side, slot, body, dt);
    return true;
  }
  if (ability.onEnd) ability.onEnd(makeCtx(state, side, dt));
  slot.active = false;
  slot.activeRemaining = 0;
  slot.windupRemaining = 0;
  slot.windupDuration = 0;
  return true;
}

/**
 * Stops any in-progress power/special move when that bey's spin hits zero.
 * Returns which sides cancelled a special (so the logo flash can be cleared).
 */
export function cancelAbilitiesOnSpinStop(state, dt) {
  if (!state.abilities) return { player: false, ai: false };
  const cancelledSpecial = { player: false, ai: false };
  for (const side of ['player', 'ai']) {
    if (state[spinKey(side)] > CONFIG.SPIN_STOPPED) continue;
    const runtime = state.abilities[side];
    if (!runtime) continue;
    for (const slotName of ['power', 'special']) {
      const slot = runtime[slotName];
      if (!slot) continue;
      if (cancelSlotOnSpinStop(state, side, slot, dt)) {
        if (slotName === 'special') cancelledSpecial[side] = true;
      }
    }
  }
  return cancelledSpecial;
}

/** Per physics step: drive active abilities that move the body (airborne homing). */
export function stepAbilities(state, dt) {
  if (!state.abilities) return;
  shared.tickBullFlipDecay(state.playerBody, dt);
  shared.tickBullFlipDecay(state.aiBody, dt);
  shared.stepBullUppercutDash(state, dt);
  shared.stepStrikerFlashPhases(state, dt);
  shared.stepLdragoAbsorbRush(state, dt);
  shared.stepLibraBusterChannel(state, dt);
  for (const side of ['player', 'ai']) {
    const runtime = state.abilities[side];
    if (!runtime) continue;
    for (const slotName of ['power', 'special']) {
      const slot = runtime[slotName];
      if (slot && slot.active && slot.ability.onStep) {
        slot.ability.onStep(makeCtx(state, side, dt));
      }
    }
  }
  cancelAbilitiesOnSpinStop(state, dt);
}
