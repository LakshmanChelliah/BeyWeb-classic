import { CONFIG } from '../config.js';
import { applySteerForce } from '../physics/steer.js';

export function createKeyboardInput(
  onStart,
  onRestart,
  onAbility,
  { canRestart = () => false, canStart = () => true, resolveAbilityKey } = {}
) {
  const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    KeyW: false,
    KeyA: false,
    KeyS: false,
    KeyD: false,
  };

  // P1: Q power · E special. P2 (2-player): N power · M special.
  const abilityKeys = {
    KeyQ: { player: 1, slot: 'power' },
    KeyE: { player: 1, slot: 'special' },
    KeyN: { player: 2, slot: 'power' },
    KeyM: { player: 2, slot: 'special' },
  };

  function clearKeys() {
    for (const code in keys) keys[code] = false;
  }

  function onKeyDown(e) {
    if (e.code in keys) {
      e.preventDefault();
      keys[e.code] = true;
    }
    let abilityBinding;
    if (resolveAbilityKey) {
      const custom = resolveAbilityKey(e.code);
      abilityBinding = custom !== undefined ? custom : abilityKeys[e.code];
    } else {
      abilityBinding = abilityKeys[e.code];
    }
    if (abilityBinding && !e.repeat) {
      e.preventDefault();
      const { player, slot } = abilityBinding;
      onAbility?.(player, slot);
    }
    if (e.code === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      if (canRestart()) onRestart?.();
      else if (canStart()) onStart?.();
    }
  }

  function onKeyUp(e) {
    if (e.code in keys) {
      e.preventDefault();
      keys[e.code] = false;
    }
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', clearKeys);

  const steerOpts = { minSpin: CONFIG.SLEEP_THRESHOLD, skipKinematic: true };

  function applyDirectionalSteer(body, spin, getDir) {
    const { dirX, dirZ } = getDir();
    applySteerForce(body, dirX, dirZ, spin, CONFIG.STEER_FORCE, steerOpts);
  }

  /** Player 1 / vs-CPU human: WASD */
  function applyPlayer1Steer(body, spin) {
    applyDirectionalSteer(body, spin, () => {
      let dirX = 0;
      let dirZ = 0;
      if (keys.KeyA) dirX -= 1;
      if (keys.KeyD) dirX += 1;
      if (keys.KeyW) dirZ -= 1;
      if (keys.KeyS) dirZ += 1;
      return { dirX, dirZ };
    });
  }

  /** Player 2 (local 2P): arrow keys */
  function applyPlayer2Steer(body, spin) {
    applyDirectionalSteer(body, spin, () => {
      let dirX = 0;
      let dirZ = 0;
      if (keys.ArrowLeft) dirX -= 1;
      if (keys.ArrowRight) dirX += 1;
      if (keys.ArrowUp) dirZ -= 1;
      if (keys.ArrowDown) dirZ += 1;
      return { dirX, dirZ };
    });
  }

  return { clearKeys, applyPlayer1Steer, applyPlayer2Steer };
}
