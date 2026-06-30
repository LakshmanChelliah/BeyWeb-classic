import { createStarBlastVfx } from './starBlastVfx.js';
import { createPegasusSpeedBoostVfx } from './pegasusSpeedBoostVfx.js';
import { createLeoneAbilityVfx } from './leoneAbilityVfx.js';
import { createLdragoAbilityVfx } from './ldragoAbilityVfx.js';
import { createLibraAbilityVfx } from './libraAbilityVfx.js';
import { createBullAbilityVfx } from './bullAbilityVfx.js';
import { createEagleAbilityVfx } from './eagleAbilityVfx.js';
import { createStrikerAbilityVfx } from './strikerAbilityVfx.js';
import { createCollisionSparksVfx } from './collisionSparksVfx.js';

function pair(factory, scene) {
  return { player: factory(scene), ai: factory(scene) };
}

/**
 * Creates per-side VFX instances for a match.
 * @param {THREE.Scene} scene
 * @param {{ mode?: string }} [opts]
 */
export function createMatchVfx(scene, { mode = 'mobile' } = {}) {
  return {
    starBlast: pair(createStarBlastVfx, scene),
    leone: pair(createLeoneAbilityVfx, scene),
    speedBoost: pair(createPegasusSpeedBoostVfx, scene),
    ldrago: pair(createLdragoAbilityVfx, scene),
    libra: pair(createLibraAbilityVfx, scene),
    bull: pair(createBullAbilityVfx, scene),
    eagle: pair(createEagleAbilityVfx, scene),
    striker: pair(createStrikerAbilityVfx, scene),
    collisionSparks: createCollisionSparksVfx(scene, {
      poolSize: mode === 'mobile' ? 64 : 128,
      countScale: mode === 'mobile' ? 0.72 : 1,
    }),
  };
}

/** Resets all match VFX to idle state. */
export function resetMatchVfx(vfx) {
  for (const key of ['starBlast', 'leone', 'speedBoost', 'ldrago', 'libra', 'bull', 'eagle', 'striker']) {
    vfx[key].player.reset();
    vfx[key].ai.reset();
  }
  vfx.collisionSparks.reset();
}

/** Per-frame VFX update pass. */
export function updateMatchVfx(vfx, { playerGroup, aiGroup, playerBody, aiBody, camera, dt }) {
  vfx.starBlast.player.update(playerGroup, playerBody, camera, dt);
  vfx.starBlast.ai.update(aiGroup, aiBody, camera, dt);
  vfx.leone.player.update(playerGroup, playerBody, camera, dt);
  vfx.leone.ai.update(aiGroup, aiBody, camera, dt);
  vfx.speedBoost.player.update(playerGroup, playerBody, camera, dt);
  vfx.speedBoost.ai.update(aiGroup, aiBody, camera, dt);
  vfx.ldrago.player.update(playerGroup, playerBody, camera, dt);
  vfx.ldrago.ai.update(aiGroup, aiBody, camera, dt);
  vfx.libra.player.update(playerGroup, playerBody, camera, dt);
  vfx.libra.ai.update(aiGroup, aiBody, camera, dt);
  vfx.bull.player.update(playerGroup, playerBody, camera, dt);
  vfx.bull.ai.update(aiGroup, aiBody, camera, dt);
  vfx.eagle.player.update(playerGroup, playerBody, camera, dt);
  vfx.eagle.ai.update(aiGroup, aiBody, camera, dt);
  vfx.striker.player.update(playerGroup, playerBody, camera, dt);
  vfx.striker.ai.update(aiGroup, aiBody, camera, dt);
  vfx.collisionSparks.update(camera, dt);
}

export {
  createStarBlastVfx,
  createPegasusSpeedBoostVfx,
  createLeoneAbilityVfx,
  createLdragoAbilityVfx,
  createLibraAbilityVfx,
  createBullAbilityVfx,
  createEagleAbilityVfx,
  createStrikerAbilityVfx,
  createCollisionSparksVfx,
};
