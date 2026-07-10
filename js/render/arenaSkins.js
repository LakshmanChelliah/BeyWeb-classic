/**
 * Arena skins are palette-only. They must never change stadium geometry:
 * dish radius, wall wedges, KO pocket gaps, barrier, or platform shape.
 *
 * Each skin supplies colors + material finish values used by render/arena.js
 * to rebuild canvas textures and MeshStandardMaterial props.
 */

export const DEFAULT_ARENA_SKIN_ID = 'classic';

const STORAGE_KEY = 'beyweb.arenaSkin';

/** @typedef {{
 *   id: string,
 *   name: string,
 *   desc?: string,
 *   dishCenter: string,
 *   dishMid: string,
 *   dishEdge: string,
 *   dishLip: number,
 *   dishRoughness: number,
 *   dishMetalness: number,
 *   wall: number,
 *   wallEmissive: number,
 *   wallEmissiveIntensity: number,
 *   wallMetalness: number,
 *   wallRoughness: number,
 *   barrier: number,
 *   barrierMetalness: number,
 *   barrierRoughness: number,
 *   platformBase: string,
 *   platformVein: string,
 *   platformGrid: string,
 *   platformRoughness: number,
 *   platformMetalness: number,
 *   base: number,
 * }} ArenaSkin */

/** @type {readonly ArenaSkin[]} */
export const ARENA_SKINS = Object.freeze([
  Object.freeze({
    id: 'classic',
    name: 'Classic',
    desc: 'Default dark dish and navy walls',
    dishCenter: '#43464d',
    dishMid: '#393c42',
    dishEdge: '#2c2f35',
    dishLip: 0x55585f,
    dishRoughness: 0.82,
    dishMetalness: 0.12,
    wall: 0x27325a,
    wallEmissive: 0x0b1430,
    wallEmissiveIntensity: 0.12,
    wallMetalness: 0.4,
    wallRoughness: 0.36,
    barrier: 0xe4e6ea,
    barrierMetalness: 0.2,
    barrierRoughness: 0.5,
    platformBase: '#c9c6bd',
    platformVein: '#bdb9af',
    platformGrid: '#a6a299',
    platformRoughness: 0.6,
    platformMetalness: 0.05,
    base: 0x10141c,
  }),
  Object.freeze({
    id: 'bb_stadium',
    name: 'BB Stadium',
    desc: 'Off-white dish, blue walls, red pocket lips',
    dishCenter: '#e8e6e0',
    dishMid: '#d4d0c8',
    dishEdge: '#c2bdb4',
    dishLip: 0xc62828,
    dishRoughness: 0.78,
    dishMetalness: 0.06,
    wall: 0x1e4a8c,
    wallEmissive: 0x0a1f45,
    wallEmissiveIntensity: 0.1,
    wallMetalness: 0.35,
    wallRoughness: 0.4,
    barrier: 0xf5f5f2,
    barrierMetalness: 0.15,
    barrierRoughness: 0.55,
    platformBase: '#d8d4cc',
    platformVein: '#c8c2b8',
    platformGrid: '#b0aaa0',
    platformRoughness: 0.65,
    platformMetalness: 0.04,
    base: 0x1a2030,
  }),
  Object.freeze({
    id: 'storm_circuit',
    name: 'Storm Circuit',
    desc: 'Deep blue dish with cyan wall glow',
    dishCenter: '#1a3a6e',
    dishMid: '#142d58',
    dishEdge: '#0e2244',
    dishLip: 0x3b82f6,
    dishRoughness: 0.75,
    dishMetalness: 0.18,
    wall: 0x1e3a6e,
    wallEmissive: 0x0ea5e9,
    wallEmissiveIntensity: 0.22,
    wallMetalness: 0.45,
    wallRoughness: 0.32,
    barrier: 0xb8d4f0,
    barrierMetalness: 0.25,
    barrierRoughness: 0.45,
    platformBase: '#2a3550',
    platformVein: '#3a4a68',
    platformGrid: '#4a5a78',
    platformRoughness: 0.55,
    platformMetalness: 0.12,
    base: 0x0a1220,
  }),
  Object.freeze({
    id: 'dragons_maw',
    name: "Dragon's Maw",
    desc: 'Charcoal dish with crimson veins',
    dishCenter: '#2a2228',
    dishMid: '#1f181c',
    dishEdge: '#151014',
    dishLip: 0x9f1239,
    dishRoughness: 0.8,
    dishMetalness: 0.2,
    wall: 0x2a1535,
    wallEmissive: 0x7c1a3a,
    wallEmissiveIntensity: 0.18,
    wallMetalness: 0.5,
    wallRoughness: 0.34,
    barrier: 0x4a3a42,
    barrierMetalness: 0.3,
    barrierRoughness: 0.48,
    platformBase: '#3a3034',
    platformVein: '#5a2838',
    platformGrid: '#4a3840',
    platformRoughness: 0.58,
    platformMetalness: 0.1,
    base: 0x0c080a,
  }),
  Object.freeze({
    id: 'high_contrast',
    name: 'High Contrast',
    desc: 'Near-black dish, bright barrier for clarity',
    dishCenter: '#1a1a1e',
    dishMid: '#121214',
    dishEdge: '#0a0a0c',
    dishLip: 0xf0f0f2,
    dishRoughness: 0.88,
    dishMetalness: 0.08,
    wall: 0x1e2a4a,
    wallEmissive: 0x152040,
    wallEmissiveIntensity: 0.08,
    wallMetalness: 0.35,
    wallRoughness: 0.4,
    barrier: 0xffffff,
    barrierMetalness: 0.1,
    barrierRoughness: 0.55,
    platformBase: '#e8e8ea',
    platformVein: '#d0d0d4',
    platformGrid: '#a8a8b0',
    platformRoughness: 0.62,
    platformMetalness: 0.04,
    base: 0x08080a,
  }),
]);

const SKIN_BY_ID = Object.freeze(
  Object.fromEntries(ARENA_SKINS.map((s) => [s.id, s]))
);

export function getArenaSkin(id) {
  return SKIN_BY_ID[id] ?? SKIN_BY_ID[DEFAULT_ARENA_SKIN_ID];
}

export function listArenaSkins() {
  return ARENA_SKINS;
}

/** Persist preferred skin id (palette only — never geometry). */
export function saveArenaSkinId(id) {
  const skin = getArenaSkin(id);
  try {
    localStorage.setItem(STORAGE_KEY, skin.id);
  } catch {
    /* ignore quota / private mode */
  }
  return skin.id;
}

/** Resolve skin from URL (?arena=), then localStorage, then default. */
export function resolveArenaSkinId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('arena');
    if (fromUrl && SKIN_BY_ID[fromUrl]) return fromUrl;
  } catch {
    /* ignore */
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SKIN_BY_ID[stored]) return stored;
  } catch {
    /* ignore */
  }
  return DEFAULT_ARENA_SKIN_ID;
}
