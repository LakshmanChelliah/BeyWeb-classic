/**
 * Arena skins are palette-only. Stadium geometry never changes.
 *
 * One anime-inspired story venue per playable bey (8 ↔ 8), with glossy
 * battle-dish materials and a painted sky-dome backdrop theme.
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
    ambience: 0x120c08,
    fogNear: 55,
    fogFar: 120,
    name: 'Face-Off Club',
    desc: "Benkei's warehouse floor — iron dish under neon alley lights",
    backdrop: {
      style: 'warehouse',
      top: '#1a1520',
      mid: '#2a1810',
      bottom: '#0a0806',
      glow: '#e85d04',
      accent: '#f59e0b',
    },
    dishCenter: '#5a4a40',
    dishMid: '#3a3028',
    dishEdge: '#241c18',
    dishLip: 0xff6a00,
    dishAccent: '#c2410c',
    dishRoughness: 0.42,
    dishMetalness: 0.55,
    wall: 0x5a4030,
    wallEmissive: 0xe85d04,
    wallEmissiveIntensity: 0.28,
    wallMetalness: 0.62,
    wallRoughness: 0.28,
    barrier: 0xb08060,
    barrierMetalness: 0.4,
    barrierRoughness: 0.35,
    platformBase: '#3a322c',
    platformVein: '#6a4020',
    platformGrid: '#504840',
    platformRoughness: 0.45,
    platformMetalness: 0.22,
    base: 0x0c0806,
  }),
  Object.freeze({
    id: 'libra_balance',
    beyId: 'libra',
    ambience: 0x140e1a,
    fogNear: 50,
    fogFar: 115,
    name: 'Dark Nebula Lab',
    desc: "Yu's ritual chamber — gold dish in violet Dark Nebula light",
    backdrop: {
      style: 'lab',
      top: '#1a0a28',
      mid: '#2a1840',
      bottom: '#0c0614',
      glow: '#d4a017',
      accent: '#a855f7',
    },
    dishCenter: '#6a5840',
    dishMid: '#4a3c28',
    dishEdge: '#2e2618',
    dishLip: 0xf0c040,
    dishRoughness: 0.32,
    dishMetalness: 0.65,
    wall: 0x7a6040,
    wallEmissive: 0xd4a017,
    wallEmissiveIntensity: 0.32,
    wallMetalness: 0.7,
    wallRoughness: 0.22,
    barrier: 0xe0c890,
    barrierMetalness: 0.5,
    barrierRoughness: 0.3,
    platformBase: '#2a2038',
    platformVein: '#6a5080',
    platformGrid: '#403050',
    platformRoughness: 0.4,
    platformMetalness: 0.25,
    base: 0x0c0612,
  }),
  Object.freeze({
    id: 'eagle_aerie',
    beyId: 'eagle',
    ambience: 0x0a1424,
    fogNear: 60,
    fogFar: 130,
    name: 'Metal Bey Rooftop',
    desc: "Tsubasa's night skyline — cool steel dish above the city",
    backdrop: {
      style: 'city_night',
      top: '#0a1830',
      mid: '#142848',
      bottom: '#060c18',
      glow: '#60a5fa',
      accent: '#38bdf8',
    },
    dishCenter: '#6a7a90',
    dishMid: '#4a5a70',
    dishEdge: '#2e3a50',
    dishLip: 0xb8d4f0,
    dishRoughness: 0.38,
    dishMetalness: 0.5,
    wall: 0x3d5a80,
    wallEmissive: 0x60a5fa,
    wallEmissiveIntensity: 0.26,
    wallMetalness: 0.55,
    wallRoughness: 0.3,
    barrier: 0xd8e8f8,
    barrierMetalness: 0.35,
    barrierRoughness: 0.38,
    platformBase: '#1a2838',
    platformVein: '#3a5878',
    platformGrid: '#2a4058',
    platformRoughness: 0.42,
    platformMetalness: 0.2,
    base: 0x060c14,
  }),
  Object.freeze({
    id: 'leone_bastion',
    beyId: 'leone',
    ambience: 0x1a1208,
    fogNear: 55,
    fogFar: 125,
    name: "Lion's Canyon",
    desc: "Kyoya's wild ground — sandstone dish under a desert sunset",
    backdrop: {
      style: 'desert_sunset',
      top: '#3a2040',
      mid: '#c45a20',
      bottom: '#2a1408',
      glow: '#f59e0b',
      accent: '#fb923c',
    },
    dishCenter: '#c4a870',
    dishMid: '#8a7048',
    dishEdge: '#5a4830',
    dishLip: 0xe8b020,
    dishRoughness: 0.48,
    dishMetalness: 0.4,
    wall: 0x6a5028,
    wallEmissive: 0xb8860b,
    wallEmissiveIntensity: 0.22,
    wallMetalness: 0.5,
    wallRoughness: 0.32,
    barrier: 0xe8d4a8,
    barrierMetalness: 0.3,
    barrierRoughness: 0.4,
    platformBase: '#4a3820',
    platformVein: '#8a6030',
    platformGrid: '#5a4830',
    platformRoughness: 0.5,
    platformMetalness: 0.15,
    base: 0x120c06,
  }),
  Object.freeze({
    id: 'storm_circuit',
    beyId: 'pegasus',
    ambience: 0x081428,
    fogNear: 50,
    fogFar: 120,
    name: 'Storm Plateau',
    desc: "Gingka's open sky — storm-lit dish under thunderclouds",
    backdrop: {
      style: 'storm',
      top: '#0a1838',
      mid: '#1e4a8c',
      bottom: '#061020',
      glow: '#38bdf8',
      accent: '#93c5fd',
    },
    dishCenter: '#2a5aaa',
    dishMid: '#1a3a78',
    dishEdge: '#0e2458',
    dishLip: 0x4fc3ff,
    dishRoughness: 0.35,
    dishMetalness: 0.58,
    wall: 0x1e4a8c,
    wallEmissive: 0x0ea5e9,
    wallEmissiveIntensity: 0.38,
    wallMetalness: 0.6,
    wallRoughness: 0.24,
    barrier: 0xc8e8ff,
    barrierMetalness: 0.4,
    barrierRoughness: 0.32,
    platformBase: '#142848',
    platformVein: '#3a6aa0',
    platformGrid: '#2a4870',
    platformRoughness: 0.4,
    platformMetalness: 0.22,
    base: 0x060e1a,
  }),
  Object.freeze({
    id: 'dragons_maw',
    beyId: 'lightning_ldrago',
    ambience: 0x10060c,
    fogNear: 45,
    fogFar: 110,
    name: 'Dark Nebula HQ',
    desc: "Ryuga's forbidden hall — charcoal dish in crimson lightning",
    backdrop: {
      style: 'nebula',
      top: '#1a0614',
      mid: '#4a0a28',
      bottom: '#080208',
      glow: '#ef4444',
      accent: '#a855f7',
    },
    dishCenter: '#3a2830',
    dishMid: '#241820',
    dishEdge: '#140c12',
    dishLip: 0xff1a4a,
    dishAccent: '#9f1239',
    dishRoughness: 0.36,
    dishMetalness: 0.6,
    wall: 0x3a1538,
    wallEmissive: 0xc41a4a,
    wallEmissiveIntensity: 0.36,
    wallMetalness: 0.65,
    wallRoughness: 0.24,
    barrier: 0x5a3048,
    barrierMetalness: 0.45,
    barrierRoughness: 0.34,
    platformBase: '#1a1018',
    platformVein: '#6a1838',
    platformGrid: '#3a2030',
    platformRoughness: 0.4,
    platformMetalness: 0.25,
    base: 0x080408,
  }),
  Object.freeze({
    id: 'striker_rink',
    beyId: 'striker',
    ambience: 0x0c1820,
    fogNear: 55,
    fogFar: 125,
    name: 'Challenge Stadium',
    desc: "Masamune's spotlight stage — ice-blue dish under arena lights",
    backdrop: {
      style: 'arena_lights',
      top: '#102030',
      mid: '#1a3850',
      bottom: '#081018',
      glow: '#f8fafc',
      accent: '#ef4444',
    },
    dishCenter: '#5a8aa0',
    dishMid: '#3a6a80',
    dishEdge: '#244858',
    dishLip: 0xff3344,
    dishRoughness: 0.3,
    dishMetalness: 0.62,
    wall: 0x1e5a70,
    wallEmissive: 0x22d3ee,
    wallEmissiveIntensity: 0.3,
    wallMetalness: 0.58,
    wallRoughness: 0.26,
    barrier: 0xf0f8fc,
    barrierMetalness: 0.35,
    barrierRoughness: 0.35,
    platformBase: '#183040',
    platformVein: '#4a7088',
    platformGrid: '#2a4858',
    platformRoughness: 0.38,
    platformMetalness: 0.2,
    base: 0x060e14,
  }),
  Object.freeze({
    id: 'meteo_crucible',
    beyId: 'meteo_ldrago',
    ambience: 0x140606,
    fogNear: 40,
    fogFar: 105,
    name: 'Forbidden Crater',
    desc: "Final L-Drago ground — molten dish in a meteor-scarred void",
    backdrop: {
      style: 'crater',
      top: '#2a0808',
      mid: '#8a1010',
      bottom: '#0a0202',
      glow: '#ff2200',
      accent: '#fb923c',
    },
    dishCenter: '#6a2020',
    dishMid: '#401010',
    dishEdge: '#200808',
    dishLip: 0xff2200,
    dishAccent: '#dc2626',
    dishRoughness: 0.34,
    dishMetalness: 0.64,
    wall: 0x4a1020,
    wallEmissive: 0xff3300,
    wallEmissiveIntensity: 0.4,
    wallMetalness: 0.68,
    wallRoughness: 0.22,
    barrier: 0x6a3030,
    barrierMetalness: 0.48,
    barrierRoughness: 0.32,
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
