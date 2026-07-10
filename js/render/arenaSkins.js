/**
 * Arena skins are palette-only. They must never change stadium geometry:
 * dish radius, wall wedges, KO pocket gaps, barrier, or platform shape.
 *
 * One skin per playable tournament bey (8 skins ↔ 8 beys).
 */

export const DEFAULT_ARENA_SKIN_ID = 'storm_circuit';

const STORAGE_KEY = 'beyweb.arenaSkin';

/** @typedef {{
 *   id: string,
 *   beyId: string,
 *   name: string,
 *   desc?: string,
 *   dishCenter: string,
 *   dishMid: string,
 *   dishEdge: string,
 *   dishLip: number,
 *   dishAccent?: string,
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
    id: 'bull_forge',
    beyId: 'bull',
    name: 'Bull Forge',
    desc: 'Scorched iron dish with ember pocket lips',
    dishCenter: '#3a2e28',
    dishMid: '#2a201c',
    dishEdge: '#1a1410',
    dishLip: 0xe85d04,
    dishAccent: '#9a3412',
    dishRoughness: 0.84,
    dishMetalness: 0.22,
    wall: 0x4a3528,
    wallEmissive: 0x7c2d12,
    wallEmissiveIntensity: 0.16,
    wallMetalness: 0.48,
    wallRoughness: 0.38,
    barrier: 0x8a7060,
    barrierMetalness: 0.28,
    barrierRoughness: 0.5,
    platformBase: '#4a4038',
    platformVein: '#6a4830',
    platformGrid: '#5a5048',
    platformRoughness: 0.62,
    platformMetalness: 0.1,
    base: 0x100c0a,
  }),
  Object.freeze({
    id: 'libra_balance',
    beyId: 'libra',
    name: 'Libra Balance',
    desc: 'Warm gold dish with silver meridian walls',
    dishCenter: '#5a4838',
    dishMid: '#3a3028',
    dishEdge: '#2a2420',
    dishLip: 0xd4a017,
    dishRoughness: 0.72,
    dishMetalness: 0.28,
    wall: 0x6b5a40,
    wallEmissive: 0xb8860b,
    wallEmissiveIntensity: 0.14,
    wallMetalness: 0.55,
    wallRoughness: 0.3,
    barrier: 0xc8b890,
    barrierMetalness: 0.35,
    barrierRoughness: 0.42,
    platformBase: '#c4b898',
    platformVein: '#a89870',
    platformGrid: '#908060',
    platformRoughness: 0.55,
    platformMetalness: 0.12,
    base: 0x18140e,
  }),
  Object.freeze({
    id: 'eagle_aerie',
    beyId: 'eagle',
    name: 'Eagle Aerie',
    desc: 'Cool sky-gray dish with feather-soft walls',
    dishCenter: '#4a5568',
    dishMid: '#3a4558',
    dishEdge: '#2a3548',
    dishLip: 0x94a3b8,
    dishRoughness: 0.78,
    dishMetalness: 0.14,
    wall: 0x3d5a80,
    wallEmissive: 0x60a5fa,
    wallEmissiveIntensity: 0.12,
    wallMetalness: 0.32,
    wallRoughness: 0.42,
    barrier: 0xd0d8e8,
    barrierMetalness: 0.18,
    barrierRoughness: 0.52,
    platformBase: '#b8c4d4',
    platformVein: '#98a8bc',
    platformGrid: '#8898ac',
    platformRoughness: 0.6,
    platformMetalness: 0.06,
    base: 0x0e1420,
  }),
  Object.freeze({
    id: 'leone_bastion',
    beyId: 'leone',
    name: 'Leone Bastion',
    desc: 'Sandstone dish with bronze lion walls',
    dishCenter: '#8a7a58',
    dishMid: '#6a5a40',
    dishEdge: '#4a4030',
    dishLip: 0xb8860b,
    dishRoughness: 0.8,
    dishMetalness: 0.1,
    wall: 0x5c4a28,
    wallEmissive: 0x8b6914,
    wallEmissiveIntensity: 0.1,
    wallMetalness: 0.4,
    wallRoughness: 0.4,
    barrier: 0xd4c4a0,
    barrierMetalness: 0.2,
    barrierRoughness: 0.55,
    platformBase: '#c8b890',
    platformVein: '#a89068',
    platformGrid: '#908060',
    platformRoughness: 0.65,
    platformMetalness: 0.05,
    base: 0x14100a,
  }),
  Object.freeze({
    id: 'storm_circuit',
    beyId: 'pegasus',
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
    beyId: 'lightning_ldrago',
    name: "Dragon's Maw",
    desc: 'Charcoal dish with crimson lightning veins',
    dishCenter: '#2a2228',
    dishMid: '#1f181c',
    dishEdge: '#151014',
    dishLip: 0x9f1239,
    dishAccent: '#7c1a3a',
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
    id: 'striker_rink',
    beyId: 'striker',
    name: 'Striker Rink',
    desc: 'Ice-blue dish with red hazard pocket lips',
    dishCenter: '#3a5a6e',
    dishMid: '#2a4a5e',
    dishEdge: '#1a3a4e',
    dishLip: 0xef4444,
    dishRoughness: 0.7,
    dishMetalness: 0.2,
    wall: 0x1e4a5c,
    wallEmissive: 0x22d3ee,
    wallEmissiveIntensity: 0.15,
    wallMetalness: 0.42,
    wallRoughness: 0.35,
    barrier: 0xe8f0f4,
    barrierMetalness: 0.22,
    barrierRoughness: 0.48,
    platformBase: '#d0e0e8',
    platformVein: '#a8c0d0',
    platformGrid: '#88a0b0',
    platformRoughness: 0.58,
    platformMetalness: 0.08,
    base: 0x0a1218,
  }),
  Object.freeze({
    id: 'meteo_crucible',
    beyId: 'meteo_ldrago',
    name: 'Meteo Crucible',
    desc: 'Molten crimson dish with dark dragon walls',
    dishCenter: '#4a1818',
    dishMid: '#301010',
    dishEdge: '#1a0808',
    dishLip: 0xdc2626,
    dishAccent: '#b91c1c',
    dishRoughness: 0.76,
    dishMetalness: 0.24,
    wall: 0x3a1020,
    wallEmissive: 0xef4444,
    wallEmissiveIntensity: 0.2,
    wallMetalness: 0.52,
    wallRoughness: 0.32,
    barrier: 0x5a3030,
    barrierMetalness: 0.32,
    barrierRoughness: 0.45,
    platformBase: '#3a2828',
    platformVein: '#6a2020',
    platformGrid: '#4a3030',
    platformRoughness: 0.56,
    platformMetalness: 0.12,
    base: 0x0a0404,
  }),
]);

const SKIN_BY_ID = Object.freeze(
  Object.fromEntries(ARENA_SKINS.map((s) => [s.id, s]))
);

const SKIN_BY_BEY = Object.freeze(
  Object.fromEntries(ARENA_SKINS.map((s) => [s.beyId, s]))
);

/** Legacy ids from earlier builds → current skin ids. */
const LEGACY_SKIN_ALIASES = Object.freeze({
  classic: 'storm_circuit',
  bb_stadium: 'leone_bastion',
  high_contrast: 'eagle_aerie',
});

export function getArenaSkin(id) {
  const resolved = LEGACY_SKIN_ALIASES[id] ?? id;
  return SKIN_BY_ID[resolved] ?? SKIN_BY_ID[DEFAULT_ARENA_SKIN_ID];
}

/** Stadium skin owned by a bey (tournament uses the opponent's). */
export function getArenaSkinForBey(beyId) {
  return SKIN_BY_BEY[beyId] ?? SKIN_BY_ID[DEFAULT_ARENA_SKIN_ID];
}

export function getArenaSkinIdForBey(beyId) {
  return getArenaSkinForBey(beyId).id;
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
    if (fromUrl) {
      const skin = getArenaSkin(fromUrl);
      if (SKIN_BY_ID[fromUrl] || LEGACY_SKIN_ALIASES[fromUrl]) return skin.id;
    }
  } catch {
    /* ignore */
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const skin = getArenaSkin(stored);
      if (SKIN_BY_ID[stored] || LEGACY_SKIN_ALIASES[stored]) return skin.id;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_ARENA_SKIN_ID;
}
