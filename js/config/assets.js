/** Central asset path helpers — all runtime GLB/logo URLs go through here. */
export const ASSET_BASE = 'assets';

export function modelUrl(file) {
  return `${ASSET_BASE}/models/${file}`;
}

export function logoUrl(file) {
  return `${ASSET_BASE}/logos/${file}`;
}

export function textureUrl(file) {
  return `${ASSET_BASE}/textures/${file}`;
}
