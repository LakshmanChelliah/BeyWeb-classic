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
 *   placement: 'ground' | 'elevated',
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
    fogFar: 160,
    name: 'Abandoned Construction Site',
    desc: "Benkei's training ground — concrete dish on unfinished slabs and hazard tape",
    placement: 'ground',
    backdrop: {
      style: 'construction',
      top: '#6a8498',
      mid: '#a8b8c4',
      bottom: '#c4b8a0',
      glow: '#f59e0b',
      accent: '#ef4444',
    },
    dishCenter: '#c8a060',
    dishMid: '#8a6840',
    dishEdge: '#5a4028',
    dishLip: 0xff6a00,
    dishAccent: '#3a2818',
    dishRoughness: 0.58,
    dishMetalness: 0.35,
    wall: 0x6a5848,
    wallEmissive: 0xe85d04,
    wallEmissiveIntensity: 0.22,
    wallMetalness: 0.45,
    wallRoughness: 0.4,
    barrier: 0xc4a030,
    barrierMetalness: 0.35,
    barrierRoughness: 0.4,
    platformBase: '#9a9a98',
    platformVein: '#6a6a68',
    platformGrid: '#707070',
    platformRoughness: 0.65,
    platformMetalness: 0.12,
    base: 0x6a7060,
  }),
  Object.freeze({
    id: 'libra_balance',
    beyId: 'libra',
    ambience: 0x87b8d8,
    fogNear: 60,
    fogFar: 160,
    name: 'Survival Island',
    desc: "Yu's remote island arena — sand-gold dish on a bright Pacific beach",
    placement: 'ground',
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
    platformBase: '#c8bc88',
    platformVein: '#6a9a48',
    platformGrid: '#a09060',
    platformRoughness: 0.62,
    platformMetalness: 0.06,
    base: 0x6a9080,
  }),
  Object.freeze({
    id: 'eagle_aerie',
    beyId: 'eagle',
    ambience: 0x1a2438,
    fogNear: 55,
    fogFar: 110,
    name: 'WBBA Headquarters',
    desc: "Tsubasa's indoor tournament arena — gold platform on teal floor, packed stands",
    placement: 'ground',
    backdrop: {
      style: 'wbba_hq',
      top: '#0a1020',
      mid: '#1a2a48',
      bottom: '#2a6a78',
      glow: '#f0e6c8',
      accent: '#e8b84a',
    },
    // Dark charcoal dish recessed into gold platform (Metal Fusion still)
    dishCenter: '#4a5058',
    dishMid: '#2e343c',
    dishEdge: '#181c22',
    dishLip: 0xd4a84a,
    dishRoughness: 0.38,
    dishMetalness: 0.4,
    wall: 0x3a4555,
    wallEmissive: 0x5a6880,
    wallEmissiveIntensity: 0.1,
    wallMetalness: 0.45,
    wallRoughness: 0.38,
    barrier: 0xd4a84a,
    barrierMetalness: 0.35,
    barrierRoughness: 0.35,
    // Gold raised platform top (flush OOB around dish) — keep saturated under blue lights
    platformBase: '#f0c45a',
    platformVein: '#e0b040',
    platformGrid: '#b88828',
    platformRoughness: 0.4,
    platformMetalness: 0.28,
    // Teal stadium floor around the gold platform
    tealFloor: '#2a9aaa',
    tealFloorDark: '#1e7888',
    base: 0xb8862a,
  }),
  Object.freeze({
    id: 'leone_bastion',
    beyId: 'leone',
    ambience: 0x6a9ac0,
    fogNear: 70,
    fogFar: 180,
    name: 'Metal Bey Rooftop',
    desc: "Kyoya's rooftop stadium — elevated deck on steel supports above the city",
    placement: 'elevated',
    backdrop: {
      style: 'rooftop_day',
      top: '#3a88c8',
      mid: '#87ceeb',
      bottom: '#b8d4e8',
      glow: '#ffffff',
      accent: '#fbbf24',
    },
    dishCenter: '#c4b090',
    dishMid: '#9a8868',
    dishEdge: '#6a5840',
    dishLip: 0x8a8070,
    dishRoughness: 0.42,
    dishMetalness: 0.48,
    wall: 0x6a5028,
    wallEmissive: 0xb8860b,
    wallEmissiveIntensity: 0.14,
    wallMetalness: 0.52,
    wallRoughness: 0.3,
    barrier: 0xe8dcc0,
    barrierMetalness: 0.3,
    barrierRoughness: 0.4,
    platformBase: '#6a7078',
    platformVein: '#4a5058',
    platformGrid: '#3a4048',
    platformRoughness: 0.7,
    platformMetalness: 0.18,
    base: 0x5a6878,
  }),
  Object.freeze({
    id: 'storm_circuit',
    beyId: 'pegasus',
    ambience: 0xc8b898,
    fogNear: 55,
    fogFar: 160,
    name: 'Koma Village',
    desc: "Gingka's home ground — classic green dish set into cracked village earth",
    placement: 'ground',
    backdrop: {
      style: 'koma_village',
      top: '#5a8ab8',
      mid: '#a8c8e0',
      bottom: '#e8dcc0',
      glow: '#fef3c7',
      accent: '#86efac',
    },
    // Classic Beyblade stadium green plastic
    dishCenter: '#3ecf4a',
    dishMid: '#22b83a',
    dishEdge: '#149028',
    dishLip: 0xc4a878,
    dishRoughness: 0.28,
    dishMetalness: 0.18,
    wall: 0xb89868,
    wallEmissive: 0x8a7040,
    wallEmissiveIntensity: 0.06,
    wallMetalness: 0.2,
    wallRoughness: 0.55,
    barrier: 0xd4c4a0,
    barrierMetalness: 0.15,
    barrierRoughness: 0.55,
    // Parched cracked earth around the dish
    platformBase: '#d8c49a',
    platformVein: '#b8a078',
    platformGrid: '#6a5438',
    platformRoughness: 0.82,
    platformMetalness: 0.04,
    base: 0xa89068,
  }),
  Object.freeze({
    id: 'dragons_maw',
    beyId: 'lightning_ldrago',
    ambience: 0x1a0a30,
    fogNear: 65,
    fogFar: 175,
    name: 'Dark Nebula HQ Rooftop',
    desc: "Ryuga's forbidden roof — steel-supported deck over a purple night city far below",
    placement: 'elevated',
    backdrop: {
      style: 'dn_rooftop_night',
      top: '#1a0a30',
      mid: '#2a1450',
      bottom: '#3a2080',
      glow: '#67e8f9',
      accent: '#a855f7',
    },
    dishCenter: '#3a2830',
    dishMid: '#241820',
    dishEdge: '#140c12',
    dishLip: 0x4a3040,
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
    base: 0x2a1840,
  }),
  Object.freeze({
    id: 'striker_rink',
    beyId: 'striker',
    ambience: 0x2a3848,
    fogNear: 52,
    fogFar: 160,
    name: 'City Streets',
    desc: "Masamune's street challenge — asphalt dish in a neon canyon",
    placement: 'ground',
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
    fogFar: 160,
    name: 'Volcano Interior',
    desc: "Final L-Drago ground — molten dish inside a living crater",
    placement: 'ground',
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
