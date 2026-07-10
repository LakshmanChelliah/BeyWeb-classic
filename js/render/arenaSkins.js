/**
 * Arena skins are palette-only. Stadium geometry never changes.
 *
 * One pivotal Metal Fusion / Masters venue per playable bey (8 ↔ 8),
 * with themed glossy dishes and dense anime-poster sky-dome backdrops.
 */

export const DEFAULT_ARENA_SKIN_ID = 'storm_circuit';

const STORAGE_KEY = 'beyweb.arenaSkin';

/** @typedef {{
 *   id: string,
 *   beyId: string,
 *   ambience: number,
 *   fogNear?: number,
 *   fogFar?: number,
 *   name: string,
 *   desc?: string,
 *   backdrop: {
 *     style: string,
 *     top: string,
 *     mid: string,
 *     bottom: string,
 *     glow?: string,
 *     accent?: string,
 *   },
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
    ambience: 0x8a9aa8,
    fogNear: 55,
    fogFar: 130,
    name: 'Abandoned Construction Site',
    desc: "Benkei's training ground — concrete dish on unfinished slabs and hazard tape",
    backdrop: {
      style: 'construction',
      top: '#6a8498',
      mid: '#a8b8c4',
      bottom: '#c4b8a0',
      glow: '#f59e0b',
      accent: '#ef4444',
    },
    dishCenter: '#8a8478',
    dishMid: '#6a6458',
    dishEdge: '#4a4438',
    dishLip: 0xff6a00,
    dishAccent: '#9a3412',
    dishRoughness: 0.55,
    dishMetalness: 0.28,
    wall: 0x6a5848,
    wallEmissive: 0xe85d04,
    wallEmissiveIntensity: 0.22,
    wallMetalness: 0.45,
    wallRoughness: 0.4,
    barrier: 0xc4a030,
    barrierMetalness: 0.35,
    barrierRoughness: 0.4,
    platformBase: '#9a9488',
    platformVein: '#6a5040',
    platformGrid: '#6a6458',
    platformRoughness: 0.62,
    platformMetalness: 0.1,
    base: 0x6a7060,
  }),
  Object.freeze({
    id: 'libra_balance',
    beyId: 'libra',
    ambience: 0x87b8d8,
    fogNear: 60,
    fogFar: 140,
    name: 'Survival Island',
    desc: "Yu's remote island arena — sand-gold dish on a bright Pacific beach",
    backdrop: {
      style: 'survival_island',
      top: '#4a90c8',
      mid: '#87ceeb',
      bottom: '#f0e0b0',
      glow: '#fef08a',
      accent: '#34d399',
    },
    dishCenter: '#f0e0b8',
    dishMid: '#d4bc80',
    dishEdge: '#b89858',
    dishLip: 0xf0c040,
    dishRoughness: 0.5,
    dishMetalness: 0.28,
    wall: 0x1e5a9c,
    wallEmissive: 0x38bdf8,
    wallEmissiveIntensity: 0.18,
    wallMetalness: 0.45,
    wallRoughness: 0.35,
    barrier: 0xf5f0e6,
    barrierMetalness: 0.2,
    barrierRoughness: 0.45,
    platformBase: '#e8d4a0',
    platformVein: '#c8a870',
    platformGrid: '#c8b888',
    platformRoughness: 0.58,
    platformMetalness: 0.08,
    base: 0x6a9080,
  }),
  Object.freeze({
    id: 'eagle_aerie',
    beyId: 'eagle',
    ambience: 0x3a5a88,
    fogNear: 55,
    fogFar: 130,
    name: 'WBBA Headquarters',
    desc: "Tsubasa's polished HQ arena — silver dish on the plaza floor",
    backdrop: {
      style: 'wbba_hq',
      top: '#1a3a6a',
      mid: '#3a6aaa',
      bottom: '#8ab0d0',
      glow: '#e2e8f0',
      accent: '#3b82f6',
    },
    dishCenter: '#e8f0f8',
    dishMid: '#b8c8dc',
    dishEdge: '#7888a0',
    dishLip: 0xc0d4f0,
    dishRoughness: 0.28,
    dishMetalness: 0.62,
    wall: 0x1e3a6e,
    wallEmissive: 0x60a5fa,
    wallEmissiveIntensity: 0.28,
    wallMetalness: 0.58,
    wallRoughness: 0.26,
    barrier: 0xf0f4f8,
    barrierMetalness: 0.4,
    barrierRoughness: 0.32,
    platformBase: '#4a5a70',
    platformVein: '#6a80a0',
    platformGrid: '#5a6a80',
    platformRoughness: 0.35,
    platformMetalness: 0.25,
    base: 0x2a3a50,
  }),
  Object.freeze({
    id: 'leone_bastion',
    beyId: 'leone',
    ambience: 0x7ab0d8,
    fogNear: 60,
    fogFar: 145,
    name: 'Metal Bey Rooftop',
    desc: "Kyoya's daytime rooftop stadium — stone dish on tar roof above the skyline",
    backdrop: {
      style: 'rooftop_day',
      top: '#4a90c8',
      mid: '#87ceeb',
      bottom: '#c8e4f8',
      glow: '#ffffff',
      accent: '#fbbf24',
    },
    dishCenter: '#c4b090',
    dishMid: '#9a8868',
    dishEdge: '#6a5840',
    dishLip: 0xe8b020,
    dishRoughness: 0.42,
    dishMetalness: 0.48,
    wall: 0x6a5028,
    wallEmissive: 0xb8860b,
    wallEmissiveIntensity: 0.18,
    wallMetalness: 0.52,
    wallRoughness: 0.3,
    barrier: 0xe8dcc0,
    barrierMetalness: 0.3,
    barrierRoughness: 0.4,
    platformBase: '#4a5058',
    platformVein: '#6a7078',
    platformGrid: '#3a4048',
    platformRoughness: 0.55,
    platformMetalness: 0.12,
    base: 0x4a6070,
  }),
  Object.freeze({
    id: 'storm_circuit',
    beyId: 'pegasus',
    ambience: 0x8aa8b8,
    fogNear: 55,
    fogFar: 135,
    name: 'Koma Village',
    desc: "Gingka's home ground — stone dish on the village dirt path",
    backdrop: {
      style: 'koma_village',
      top: '#5a8ab8',
      mid: '#a8c8e0',
      bottom: '#e8dcc0',
      glow: '#fef3c7',
      accent: '#86efac',
    },
    dishCenter: '#9a9078',
    dishMid: '#6a6450',
    dishEdge: '#4a4438',
    dishLip: 0x6b8f5e,
    dishAccent: '#4a5a40',
    dishRoughness: 0.55,
    dishMetalness: 0.32,
    wall: 0x4a5840,
    wallEmissive: 0x65a30d,
    wallEmissiveIntensity: 0.14,
    wallMetalness: 0.4,
    wallRoughness: 0.4,
    barrier: 0xc8c0b0,
    barrierMetalness: 0.25,
    barrierRoughness: 0.48,
    platformBase: '#7a6a50',
    platformVein: '#8a7858',
    platformGrid: '#5a4a38',
    platformRoughness: 0.6,
    platformMetalness: 0.1,
    base: 0x5a6850,
  }),
  Object.freeze({
    id: 'dragons_maw',
    beyId: 'lightning_ldrago',
    ambience: 0x0c0610,
    fogNear: 45,
    fogFar: 110,
    name: 'Dark Nebula HQ Rooftop',
    desc: "Ryuga's forbidden roof — charcoal dish over a moody night city",
    backdrop: {
      style: 'dn_rooftop_night',
      top: '#0a0614',
      mid: '#1a0a28',
      bottom: '#080410',
      glow: '#ef4444',
      accent: '#a855f7',
    },
    dishCenter: '#3a2830',
    dishMid: '#241820',
    dishEdge: '#140c12',
    dishLip: 0xff1a4a,
    dishAccent: '#9f1239',
    dishRoughness: 0.34,
    dishMetalness: 0.62,
    wall: 0x2a1535,
    wallEmissive: 0xc41a4a,
    wallEmissiveIntensity: 0.34,
    wallMetalness: 0.65,
    wallRoughness: 0.24,
    barrier: 0x4a3048,
    barrierMetalness: 0.45,
    barrierRoughness: 0.34,
    platformBase: '#1a1018',
    platformVein: '#5a1838',
    platformGrid: '#3a2030',
    platformRoughness: 0.4,
    platformMetalness: 0.25,
    base: 0x060408,
  }),
  Object.freeze({
    id: 'striker_rink',
    beyId: 'striker',
    ambience: 0x2a3848,
    fogNear: 52,
    fogFar: 125,
    name: 'City Streets',
    desc: "Masamune's street challenge — asphalt dish in a neon canyon",
    backdrop: {
      style: 'city_streets',
      top: '#1a2848',
      mid: '#3a5070',
      bottom: '#687888',
      glow: '#22d3ee',
      accent: '#ef4444',
    },
    dishCenter: '#5a6068',
    dishMid: '#3a4048',
    dishEdge: '#222830',
    dishLip: 0xff3344,
    dishRoughness: 0.42,
    dishMetalness: 0.48,
    wall: 0x1e4a5c,
    wallEmissive: 0x22d3ee,
    wallEmissiveIntensity: 0.28,
    wallMetalness: 0.55,
    wallRoughness: 0.3,
    barrier: 0xe8f0f4,
    barrierMetalness: 0.3,
    barrierRoughness: 0.4,
    platformBase: '#3a3a42',
    platformVein: '#5a5868',
    platformGrid: '#4a4a52',
    platformRoughness: 0.5,
    platformMetalness: 0.15,
    base: 0x1a2028,
  }),
  Object.freeze({
    id: 'meteo_crucible',
    beyId: 'meteo_ldrago',
    ambience: 0x180808,
    fogNear: 38,
    fogFar: 100,
    name: 'Volcano Interior',
    desc: "Final L-Drago ground — molten dish inside a living crater",
    backdrop: {
      style: 'volcano',
      top: '#2a0a08',
      mid: '#8a1810',
      bottom: '#0a0202',
      glow: '#ff3300',
      accent: '#fb923c',
    },
    dishCenter: '#6a2820',
    dishMid: '#401410',
    dishEdge: '#200808',
    dishLip: 0xff2200,
    dishAccent: '#dc2626',
    dishRoughness: 0.32,
    dishMetalness: 0.66,
    wall: 0x4a1020,
    wallEmissive: 0xff3300,
    wallEmissiveIntensity: 0.42,
    wallMetalness: 0.7,
    wallRoughness: 0.22,
    barrier: 0x6a3030,
    barrierMetalness: 0.5,
    barrierRoughness: 0.3,
    platformBase: '#201010',
    platformVein: '#801818',
    platformGrid: '#401818',
    platformRoughness: 0.38,
    platformMetalness: 0.28,
    base: 0x080202,
  }),
]);

const SKIN_BY_ID = Object.freeze(
  Object.fromEntries(ARENA_SKINS.map((s) => [s.id, s]))
);

const SKIN_BY_BEY = Object.freeze(
  Object.fromEntries(ARENA_SKINS.map((s) => [s.beyId, s]))
);

const LEGACY_SKIN_ALIASES = Object.freeze({
  classic: 'storm_circuit',
  bb_stadium: 'leone_bastion',
  high_contrast: 'eagle_aerie',
});

export function getArenaSkin(id) {
  const resolved = LEGACY_SKIN_ALIASES[id] ?? id;
  return SKIN_BY_ID[resolved] ?? SKIN_BY_ID[DEFAULT_ARENA_SKIN_ID];
}

export function getArenaSkinForBey(beyId) {
  return SKIN_BY_BEY[beyId] ?? SKIN_BY_ID[DEFAULT_ARENA_SKIN_ID];
}

export function getArenaSkinIdForBey(beyId) {
  return getArenaSkinForBey(beyId).id;
}

export function listArenaSkins() {
  return ARENA_SKINS;
}

export function saveArenaSkinId(id) {
  const skin = getArenaSkin(id);
  try {
    localStorage.setItem(STORAGE_KEY, skin.id);
  } catch {
    /* ignore */
  }
  return skin.id;
}

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
