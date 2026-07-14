/**
 * Runtime asset URL helpers - single source of truth for model and logo paths.
 *
 * Production media lives under `assets/models/` and `assets/logos/`.
 * Pipeline / reference / debug files live under `pipeline/` and are not
 * required at runtime (and should stay out of production deploys).
 */

export const ASSETS = Object.freeze({
  MODELS: 'assets/models/',
  LOGOS: 'assets/logos/',
});

/** @param {string} filename GLB basename, e.g. `storm_pegasus.glb` */
export function modelUrl(filename) {
  return ASSETS.MODELS + filename;
}

/** @param {string} filename PNG basename, e.g. `pegasusLogo.png` */
export function logoUrl(filename) {
  return ASSETS.LOGOS + filename;
}
