import { CONFIG } from '../../config.js';
import * as shared from './shared.js';
import * as C from './constants.js';
import { activateSlot, makeCtx } from './runtime.js';

export function tickAbilityTimers(state, dt) {
  if (!state.abilities) return;
  for (const side of ['player', 'ai']) {
    const runtime = state.abilities[side];
    if (!runtime) continue;
    for (const slotName of ['power', 'special']) {
      const slot = runtime[slotName];
      if (!slot) continue;
      if (slot.cooldownRemaining > 0) {
        slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - dt);
      }
      if (slot.windupRemaining > 0) {
        slot.windupRemaining = Math.max(0, slot.windupRemaining - dt);
        if (slot.windupRemaining === 0) activateSlot(state, side, slot);
      } else if (slot.active) {
        if (slot.ability.id === 'pegasus_star_blast') {
          // Phase machine in tickAbilityVisuals ends this move.
          slot.activeRemaining = Math.max(0, slot.activeRemaining - dt);
          if (slot.activeRemaining === 0 && slot.active) {
            const body = side === 'player' ? state.playerBody : state.aiBody;
            if (body) shared.finishStarBlast(state, side, slot, body, dt);
          }
        } else if (slot.ability.id === 'bull_red_horn_uppercut') {
          // Phase machine in tickBullAbilityVisuals ends this move.
          slot.activeRemaining = Math.max(0, slot.activeRemaining - dt);
          if (slot.activeRemaining === 0 && slot.active) {
            const body = side === 'player' ? state.playerBody : state.aiBody;
            const phase = body?.userData.bullUpperPhase;
            if (body && phase == null) {
              shared.finishBullUppercut(state, side, slot, body, dt);
            } else if (body && (phase === 'dash' || body.userData.bullDashDone)) {
              shared.releaseBullUppercutControl(body);
              shared.finishBullUppercut(state, side, slot, body, dt);
            }
          }
        } else if (slot.ability.id === 'striker_lightning_flash') {
          slot.activeRemaining = Math.max(0, slot.activeRemaining - dt);
          if (slot.activeRemaining === 0 && slot.active) {
            const body = side === 'player' ? state.playerBody : state.aiBody;
            const phase = body?.userData.strikerFlashPhase;
            if (body && phase == null) {
              shared.finishStrikerFlash(state, side, slot, body, dt);
            } else if (body && (phase === 'dash' || phase === 'vanish' || phase === 'reappear' || body.userData.strikerDashDone)) {
              shared.releaseStrikerFlashControl(body);
              shared.finishStrikerFlash(state, side, slot, body, dt);
            }
          }
        } else if (slot.ability.id === 'ldrago_absorb_break') {
          slot.activeRemaining = Math.max(0, slot.activeRemaining - dt);
          if (slot.activeRemaining === 0 && slot.active) {
            const body = side === 'player' ? state.playerBody : state.aiBody;
            const phase = body?.userData.ldragoAbsorbPhase;
            if (body && phase == null) {
              shared.finishLdragoAbsorb(state, side, slot, body, dt);
            } else if (body && (phase === 'rush' || body.userData.ldragoAbsorbDashDone)) {
              shared.releaseLdragoAbsorbControl(body);
              shared.finishLdragoAbsorb(state, side, slot, body, dt);
            }
          }
        } else if (slot.ability.id === 'eagle_diving_crush') {
          // Phase machine in tickEagleAbilityVisuals ends this move.
          slot.activeRemaining = Math.max(0, slot.activeRemaining - dt);
          if (slot.activeRemaining === 0 && slot.active) {
            const body = side === 'player' ? state.playerBody : state.aiBody;
            if (body) shared.finishEagleDive(state, side, slot, body, dt);
          }
        } else {
          slot.activeRemaining = Math.max(0, slot.activeRemaining - dt);
          if (slot.activeRemaining === 0) {
            if (slot.ability.onEnd) slot.ability.onEnd(makeCtx(state, side, dt));
            slot.active = false;
          }
        }
      }
    }
  }
}

