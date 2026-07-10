import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  DEFAULT_ARENA_SKIN_ID,
  getArenaSkin,
  resolveArenaSkinId,
} from './arenaSkins.js?v=51';
import { createBackdropTexture } from './arenaBackdrop.js?v=51';

/**
 * Stadium battle geometry is fixed (dish radius / walls / pockets).
 * Venue skins swap materials plus placement:
 * ground venues sit flush in a continuous floor; rooftop venues are elevated
 * decks over city sky (like the classic elevated stadium look).
 */

const DISH_RADIUS = CONFIG.WALL_RADIUS + 0.15;
const PLATFORM_OUTER_RADIUS = CONFIG.PLATFORM_OUTER_RADIUS;
/** Out-of-bounds ground flush with the stadium rim (ground venues only). */
const GROUND_RADIUS = 78;
const SKY_RADIUS = 95;
/** How far the dish sits below the surrounding floor (recessed pit). */
const DISH_RECESS = 0.07;

function isElevated(skin) {
  return skin?.placement === 'elevated';
}

function createDishTexture(skin) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  // Bowl shading: bright center, darker rim — reads as a sunken dish.
  const grad = ctx.createRadialGradient(cx, cy * 0.88, r * 0.05, cx, cy, r);
  grad.addColorStop(0, skin.dishCenter);
  grad.addColorStop(0.45, skin.dishMid);
  grad.addColorStop(0.82, skin.dishEdge);
  grad.addColorStop(1, shadeHex(skin.dishEdge, 0.65));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner shadow ring (depth cue).
  const shade = ctx.createRadialGradient(cx, cy, r * 0.72, cx, cy, r);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = shade;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 4;
  for (const rr of [0.32, 0.55, 0.78]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  const gloss = ctx.createRadialGradient(cx * 0.72, cy * 0.52, 2, cx * 0.72, cy * 0.52, r * 0.38);
  gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Clean glossy plastic for Koma green dish — no etched spokes.
  if (skin.dishAccent && skin.backdrop?.style !== 'koma_village') {
    ctx.strokeStyle = skin.dishAccent;
    ctx.globalAlpha = 0.32;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.18, cy + Math.sin(a) * r * 0.18);
      ctx.lineTo(cx + Math.cos(a) * r * 0.92, cy + Math.sin(a) * r * 0.92);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // Extra plastic gloss for the classic green Koma dish.
  if (skin.backdrop?.style === 'koma_village') {
    const gloss2 = ctx.createRadialGradient(cx * 0.65, cy * 0.45, 2, cx * 0.65, cy * 0.45, r * 0.5);
    gloss2.addColorStop(0, 'rgba(255,255,255,0.35)');
    gloss2.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gloss2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Construction: metal/wood slats like the anime site stadium.
  if (skin.backdrop?.style === 'construction') {
    ctx.strokeStyle = 'rgba(40,28,18,0.45)';
    ctx.lineWidth = 5;
    for (let i = -20; i < 40; i++) {
      const y = cy - r + i * 28;
      ctx.beginPath();
      ctx.moveTo(cx - r, y);
      ctx.lineTo(cx + r, y + 12);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function shadeHex(hexOrCss, factor) {
  if (typeof hexOrCss === 'string' && hexOrCss.startsWith('#')) {
    const n = parseInt(hexOrCss.slice(1), 16);
    const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)));
    const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)));
    const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)));
    return `rgb(${r},${g},${b})`;
  }
  return hexOrCss;
}

/**
 * Near-field floor ring (dish rim → barrier): large tiles / venue surface,
 * continuous with the far ground — same height, not a raised pad.
 */
function createPlatformTexture(skin) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const style = skin.backdrop?.style || 'construction';

  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  paintVenueFloor(ctx, size, skin, style, true);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

/**
 * Far out-of-bounds ground — same level as the stadium rim.
 */
function createGroundTexture(skin) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const style = skin.backdrop?.style || 'construction';

  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  paintVenueFloor(ctx, size, skin, style, false);

  const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.22, size / 2, size / 2, size * 0.5);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,0.28)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

function paintVenueFloor(ctx, size, skin, style, nearField) {
  switch (style) {
    case 'construction':
      paintFloorConcrete(ctx, size, skin, nearField);
      break;
    case 'survival_island':
      paintFloorIsland(ctx, size, skin);
      break;
    case 'wbba_hq':
      paintFloorTiles(ctx, size, skin, nearField ? 5 : 8);
      break;
    case 'rooftop_day':
      paintFloorRooftopTar(ctx, size, skin);
      break;
    case 'koma_village':
      paintFloorCrackedEarth(ctx, size, skin);
      break;
    case 'dn_rooftop_night':
      paintFloorRooftopDark(ctx, size, skin);
      break;
    case 'city_streets':
      paintFloorAsphalt(ctx, size, skin);
      break;
    case 'volcano':
      paintFloorVolcanic(ctx, size, skin);
      break;
    default:
      paintFloorTiles(ctx, size, skin, 6);
  }
}

/** Large square tiles — tournament plaza / WBBA / rooftop. */
function paintFloorTiles(ctx, size, skin, divisions) {
  const tile = size / divisions;
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = skin.platformGrid;
  ctx.lineWidth = nearLine(divisions);
  for (let i = 0; i <= divisions; i++) {
    const p = i * tile;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let y = 0; y < divisions; y++) {
    for (let x = 0; x < divisions; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
}

function nearLine(divisions) {
  return divisions <= 5 ? 5 : 3;
}

/** Construction site — grey concrete slabs + hazard accents. */
function paintFloorConcrete(ctx, size, skin, nearField) {
  const tile = size / (nearField ? 3 : 4);
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = skin.platformGrid;
  ctx.lineWidth = 7;
  for (let i = 0; i <= 4; i++) {
    const p = i * tile;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  // Dust / wear
  for (let i = 0; i < 80; i++) {
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = i % 2 ? '#fff' : '#222';
    ctx.fillRect(Math.random() * size, Math.random() * size, 40, 18);
  }
  ctx.globalAlpha = 1;
  if (nearField) {
    ctx.strokeStyle = '#e8a020';
    ctx.lineWidth = 14;
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 60 + i * 180);
      ctx.lineTo(size, 140 + i * 180);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

/** Survival Island — grass near dish, sand grain. */
function paintFloorIsland(ctx, size, skin) {
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.55);
  g.addColorStop(0, '#6aaa48');
  g.addColorStop(0.35, '#8abc58');
  g.addColorStop(0.65, skin.platformBase);
  g.addColorStop(1, '#d4bc80');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 100; i++) {
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = Math.random() > 0.5 ? '#fff6d0' : '#3a7040';
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      12 + Math.random() * 40,
      6 + Math.random() * 14,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Koma / earth — cracked ground radiating from center (impact crater). */
function paintFloorCrackedEarth(ctx, size, skin) {
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  ctx.strokeStyle = skin.platformGrid;
  ctx.lineWidth = 4;
  ctx.globalAlpha = 0.75;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30);
    let x = cx + Math.cos(a) * 30;
    let y = cy + Math.sin(a) * 30;
    for (let s = 0; s < 6; s++) {
      x += Math.cos(a + (Math.random() - 0.5) * 0.5) * (40 + Math.random() * 50);
      y += Math.sin(a + (Math.random() - 0.5) * 0.5) * (40 + Math.random() * 50);
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Flagstone patches
  ctx.strokeStyle = skin.platformVein;
  ctx.lineWidth = 2;
  for (let i = 0; i < 28; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeRect(x, y, 50 + Math.random() * 70, 35 + Math.random() * 50);
  }
}

function paintFloorRooftopTar(ctx, size, skin) {
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = skin.platformGrid;
  ctx.lineWidth = 5;
  for (let i = 1; i < 6; i++) {
    const p = (i / 6) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  ctx.fillStyle = skin.platformVein || '#5a5048';
  for (let i = 0; i < 10; i++) {
    const x = ((i * 97) % (size - 80)) + 20;
    const y = ((i * 53) % (size - 60)) + 15;
    ctx.fillRect(x, y, 36, 22);
  }
}

function paintFloorRooftopDark(ctx, size, skin) {
  paintFloorRooftopTar(ctx, size, skin);
  ctx.fillStyle = 'rgba(120,40,80,0.12)';
  ctx.fillRect(0, 0, size, size);
}

function paintFloorAsphalt(ctx, size, skin) {
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 220; i++) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = Math.random() > 0.5 ? '#777' : '#1a1a1a';
    ctx.fillRect(Math.random() * size, Math.random() * size, 4, 4);
  }
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 8;
  ctx.setLineDash([36, 28]);
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(size * 0.5, size);
  ctx.stroke();
  ctx.setLineDash([]);
}

function paintFloorVolcanic(ctx, size, skin) {
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  const cx = size / 2;
  const cy = size / 2;
  ctx.strokeStyle = skin.dishAccent || '#dc2626';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(
      cx + Math.cos(a + 0.3) * size * 0.25,
      cy + Math.sin(a + 0.3) * size * 0.25,
      cx + Math.cos(a) * size * 0.5,
      cy + Math.sin(a) * size * 0.5
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (let i = 0; i < 24; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 16);
    g.addColorStop(0, 'rgba(255,90,0,0.5)');
    g.addColorStop(1, 'rgba(255,90,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  }
}

function disposeMap(mat) {
  if (mat?.map) {
    mat.map.dispose();
    mat.map = null;
  }
}

function createWedgeShape() {
  const innerX = -0.62;
  const outerX = 0.62;
  const h = CONFIG.WALL_HEIGHT * 0.9;
  const shape = new THREE.Shape();
  shape.moveTo(innerX, 0);
  shape.lineTo(innerX * 0.25, h);
  shape.lineTo(outerX, h);
  shape.lineTo(outerX, 0);
  shape.closePath();
  return shape;
}

function addWallSegments(group, wallMat) {
  const wedge = createWedgeShape();
  const radius = CONFIG.WALL_RADIUS + 0.1;
  // Bury wall bases under the floor so they read as pit walls, not a floating pad.
  const wallEmbedY = -0.45;

  for (let i = 0; i < CONFIG.POCKET_ANGLES.length; i++) {
    const pocketStart = CONFIG.POCKET_ANGLES[i];
    const pocketEnd = CONFIG.POCKET_ANGLES[(i + 1) % CONFIG.POCKET_ANGLES.length];
    let wallStart = pocketStart + CONFIG.POCKET_HALF_WIDTH;
    let wallEnd = pocketEnd - CONFIG.POCKET_HALF_WIDTH;
    if (wallEnd < wallStart) wallEnd += Math.PI * 2;

    const span = wallEnd - wallStart;
    const segments = Math.max(10, CONFIG.WALL_SEGMENTS_PER_ARC * 2);
    const arcLen = span * radius;
    const segDepth = (arcLen / segments) * 1.25;

    for (let j = 0; j <= segments; j++) {
      const angle = wallStart + (span * j) / segments;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const geo = new THREE.ExtrudeGeometry(wedge, {
        depth: segDepth,
        bevelEnabled: false,
      });
      geo.translate(0, 0, -segDepth / 2);

      const wall = new THREE.Mesh(geo, wallMat);
      wall.userData.arenaPart = 'wall';
      wall.position.set(x, wallEmbedY, z);
      wall.rotation.y = -angle;
      // No cast shadow — under-wall shadows were reading as a floating stadium pad.
      wall.castShadow = false;
      wall.receiveShadow = true;
      group.add(wall);
    }
  }
}

/** Horizon sky — full sphere so elevated rooftops show city sky below the deck. */
function createSkyDome(skin) {
  const mat = new THREE.MeshBasicMaterial({
    map: createBackdropTexture(skin),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 48, 32),
    mat
  );
  dome.userData.arenaPart = 'sky';
  dome.position.y = 0;
  dome.renderOrder = -10;
  return dome;
}

function applyPlacement(parts, skin) {
  const elevated = isElevated(skin);
  if (parts.ground) parts.ground.visible = !elevated;
  if (parts.platform) parts.platform.visible = elevated;
  if (parts.base) parts.base.visible = elevated;
  if (parts.supports) parts.supports.visible = elevated;
  if (parts.city) parts.city.visible = elevated;
}

function tintCityForSkin(city, skin) {
  if (!city) return;
  const night = skin.backdrop?.style === 'dn_rooftop_night';
  city.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mat = obj.material;
    if (obj.userData.cityPart === 'building') {
      mat.color.setHex(night ? 0x12101c : 0x5a6878);
      mat.emissive?.setHex?.(night ? 0x4a2080 : 0x000000);
      mat.emissiveIntensity = night ? 0.15 : 0;
    } else if (obj.userData.cityPart === 'window') {
      mat.color.setHex(night ? 0xc084fc : 0xc8dce8);
      mat.emissive?.setHex?.(night ? 0xa855f7 : 0x88aacc);
      mat.emissiveIntensity = night ? 0.55 : 0.2;
    } else if (obj.userData.cityPart === 'support') {
      mat.color.setHex(night ? 0x2a2030 : 0x6a7888);
    }
  });
}

/**
 * Steel supports under the rooftop deck — reads as a stadium in the sky.
 */
function createRooftopSupports(skin) {
  const group = new THREE.Group();
  group.userData.arenaPart = 'supports';
  const steel = new THREE.MeshStandardMaterial({
    color: skin.base ?? 0x6a7888,
    metalness: 0.65,
    roughness: 0.35,
  });

  // Tall building shaft under the deck
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(PLATFORM_OUTER_RADIUS * 0.55, PLATFORM_OUTER_RADIUS * 0.7, 22, 24),
    steel.clone()
  );
  shaft.userData.cityPart = 'support';
  shaft.position.y = -11.5;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // Outer ring of pillars at the deck edge
  const pillarGeo = new THREE.BoxGeometry(0.7, 14, 0.7);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = PLATFORM_OUTER_RADIUS - 1.2;
    const pillar = new THREE.Mesh(pillarGeo, steel.clone());
    pillar.userData.cityPart = 'support';
    pillar.position.set(Math.cos(a) * r, -7.2, Math.sin(a) * r);
    pillar.castShadow = true;
    group.add(pillar);
  }

  // Diagonal braces under the deck
  const braceGeo = new THREE.BoxGeometry(0.35, 10, 0.35);
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.15;
    const r = PLATFORM_OUTER_RADIUS - 2.5;
    const brace = new THREE.Mesh(braceGeo, steel.clone());
    brace.userData.cityPart = 'support';
    brace.position.set(Math.cos(a) * r, -5.5, Math.sin(a) * r);
    brace.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.45;
    brace.rotation.y = -a;
    group.add(brace);
  }

  // Underside ring / lip
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(PLATFORM_OUTER_RADIUS - 0.4, 0.35, 8, 48),
    steel.clone()
  );
  lip.userData.cityPart = 'support';
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.4;
  group.add(lip);

  return group;
}

/**
 * 3D city around an elevated rooftop — skyscrapers taller than the stadium
 * so the venue reads as a deck in the sky, not a pad in a blue void.
 */
function createRooftopCity(skin) {
  const group = new THREE.Group();
  group.userData.arenaPart = 'city';
  const night = skin.backdrop?.style === 'dn_rooftop_night';

  const buildingMat = new THREE.MeshStandardMaterial({
    color: night ? 0x12101c : 0x5a6878,
    roughness: 0.72,
    metalness: 0.25,
    emissive: night ? 0x4a2080 : 0x000000,
    emissiveIntensity: night ? 0.12 : 0,
  });
  const windowMat = new THREE.MeshStandardMaterial({
    color: night ? 0xc084fc : 0xc8dce8,
    roughness: 0.35,
    metalness: 0.4,
    emissive: night ? 0xa855f7 : 0x88aacc,
    emissiveIntensity: night ? 0.5 : 0.18,
  });

  // Deterministic layout — buildings surround the deck and rise above wall height (~2).
  const specs = [
    { a: 0.15, r: 28, w: 5, d: 5, h: 36 },
    { a: 0.55, r: 32, w: 4, d: 6, h: 28 },
    { a: 1.0, r: 26, w: 6, d: 4, h: 42 },
    { a: 1.4, r: 34, w: 5, d: 5, h: 24 },
    { a: 1.85, r: 29, w: 4, d: 7, h: 38 },
    { a: 2.3, r: 36, w: 7, d: 4, h: 30 },
    { a: 2.7, r: 27, w: 5, d: 5, h: 44 },
    { a: 3.15, r: 33, w: 4, d: 4, h: 22 },
    { a: 3.55, r: 30, w: 6, d: 5, h: 40 },
    { a: 4.0, r: 38, w: 5, d: 6, h: 26 },
    { a: 4.4, r: 28, w: 4, d: 5, h: 34 },
    { a: 4.85, r: 35, w: 6, d: 4, h: 48 },
    { a: 5.3, r: 31, w: 5, d: 5, h: 32 },
    { a: 5.75, r: 40, w: 4, d: 4, h: 20 },
    { a: 0.35, r: 45, w: 8, d: 6, h: 52 },
    { a: 2.0, r: 48, w: 6, d: 8, h: 46 },
    { a: 3.8, r: 46, w: 7, d: 5, h: 55 },
    { a: 5.1, r: 44, w: 5, d: 7, h: 38 },
  ];

  for (const s of specs) {
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(s.w, s.h, s.d),
      buildingMat.clone()
    );
    building.userData.cityPart = 'building';
    // Bottom of building well below deck; top rises far above stadium walls.
    building.position.set(
      Math.cos(s.a) * s.r,
      s.h * 0.5 - 18,
      Math.sin(s.a) * s.r
    );
    building.castShadow = true;
    building.receiveShadow = true;
    group.add(building);

    // Simple window strip on the face toward the stadium
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(s.w * 0.7, s.h * 0.85, 0.15),
      windowMat.clone()
    );
    win.userData.cityPart = 'window';
    const inward = Math.atan2(-Math.sin(s.a), -Math.cos(s.a));
    win.position.set(
      Math.cos(s.a) * (s.r - s.d * 0.52),
      s.h * 0.5 - 18,
      Math.sin(s.a) * (s.r - s.d * 0.52)
    );
    win.rotation.y = inward;
    group.add(win);
  }

  return group;
}

function applySkinToParts(parts, skin) {
  applyPlacement(parts, skin);

  if (parts.ground?.material) {
    disposeMap(parts.ground.material);
    const groundMap = createGroundTexture(skin);
    groundMap.needsUpdate = true;
    parts.ground.material.map = groundMap;
    parts.ground.material.color.setHex(0xffffff);
    parts.ground.material.roughness = skin.platformRoughness ?? 0.6;
    parts.ground.material.metalness = skin.platformMetalness ?? 0.1;
    parts.ground.material.needsUpdate = true;
  }

  if (parts.platform?.material) {
    disposeMap(parts.platform.material);
    const platformMap = createPlatformTexture(skin);
    platformMap.needsUpdate = true;
    parts.platform.material.map = platformMap;
    parts.platform.material.color.setHex(0xffffff);
    parts.platform.material.roughness = skin.platformRoughness ?? 0.55;
    parts.platform.material.metalness = skin.platformMetalness ?? 0.12;
    parts.platform.material.needsUpdate = true;
  }

  if (parts.base?.material) {
    parts.base.material.color.setHex(skin.base ?? 0x333333);
    parts.base.material.needsUpdate = true;
  }

  tintCityForSkin(parts.city, skin);
  tintCityForSkin(parts.supports, skin);

  disposeMap(parts.dish.material);
  const dishMap = createDishTexture(skin);
  dishMap.needsUpdate = true;
  parts.dish.material.map = dishMap;
  parts.dish.material.color.setHex(0xffffff);
  parts.dish.material.roughness = skin.dishRoughness;
  parts.dish.material.metalness = skin.dishMetalness;
  parts.dish.material.needsUpdate = true;

  parts.dishLip.material.color.setHex(skin.dishLip);
  parts.dishLip.material.metalness = 0.45;
  parts.dishLip.material.roughness = 0.4;
  parts.dishLip.material.emissive.setHex(skin.dishLip);
  parts.dishLip.material.emissiveIntensity = 0.06;
  parts.dishLip.material.needsUpdate = true;

  parts.wallMat.color.setHex(skin.wall);
  parts.wallMat.emissive.setHex(skin.wallEmissive);
  parts.wallMat.emissiveIntensity = skin.wallEmissiveIntensity;
  parts.wallMat.metalness = skin.wallMetalness;
  parts.wallMat.roughness = skin.wallRoughness;
  parts.wallMat.needsUpdate = true;

  if (parts.sky?.material) {
    disposeMap(parts.sky.material);
    const skyMap = createBackdropTexture(skin);
    skyMap.needsUpdate = true;
    parts.sky.material.map = skyMap;
    parts.sky.material.needsUpdate = true;
  }
}

function applySceneAmbience(scene, skin) {
  if (!scene || skin.ambience == null) return;
  if (scene.background?.isColor) scene.background.setHex(skin.ambience);
  else scene.background = new THREE.Color(skin.ambience);
  if (scene.fog?.color) {
    scene.fog.color.setHex(skin.ambience);
    if (skin.fogNear != null) scene.fog.near = skin.fogNear;
    if (skin.fogFar != null) scene.fog.far = skin.fogFar;
  }
}

export function applyArenaSkin(group, skinId) {
  const parts = group?.userData?.arenaParts;
  if (!parts) return null;
  const skin = getArenaSkin(skinId);
  applySkinToParts(parts, skin);
  applySceneAmbience(group.userData.scene, skin);
  group.userData.arenaSkinId = skin.id;
  return skin.id;
}

/**
 * Anime venue arena:
 * - ground venues: dish recessed into a continuous floor
 * - elevated venues (rooftops): deck + building base over city sky
 * Battle radii / walls / pockets stay fixed.
 */
export function createArenaMesh(scene, skinId = resolveArenaSkinId()) {
  const skin = getArenaSkin(skinId ?? DEFAULT_ARENA_SKIN_ID);
  const group = new THREE.Group();
  group.userData.arenaSkinId = skin.id;
  group.userData.scene = scene;
  applySceneAmbience(scene, skin);

  const sky = createSkyDome(skin);
  group.add(sky);

  const floorY = CONFIG.FLOOR_Y;

  // Ground venues: continuous OOB floor from dish rim → horizon.
  const ground = new THREE.Mesh(
    new THREE.RingGeometry(DISH_RADIUS + 0.02, GROUND_RADIUS, 128),
    new THREE.MeshStandardMaterial({
      map: createGroundTexture(skin),
      roughness: skin.platformRoughness ?? 0.6,
      metalness: skin.platformMetalness ?? 0.1,
    })
  );
  ground.userData.arenaPart = 'ground';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = floorY;
  ground.receiveShadow = true;
  ground.castShadow = false;
  group.add(ground);

  // Elevated venues: rooftop deck (finite platform over the city).
  const platform = new THREE.Mesh(
    new THREE.CircleGeometry(PLATFORM_OUTER_RADIUS, 80),
    new THREE.MeshStandardMaterial({
      map: createPlatformTexture(skin),
      roughness: skin.platformRoughness ?? 0.55,
      metalness: skin.platformMetalness ?? 0.12,
    })
  );
  platform.userData.arenaPart = 'platform';
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = floorY;
  platform.receiveShadow = true;
  platform.castShadow = false;
  group.add(platform);

  // Building mass under the rooftop deck (short cap — tall shaft is in supports).
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(
      PLATFORM_OUTER_RADIUS - 0.2,
      PLATFORM_OUTER_RADIUS + 0.4,
      2.2,
      80
    ),
    new THREE.MeshStandardMaterial({
      color: skin.base ?? 0x333333,
      metalness: 0.35,
      roughness: 0.7,
    })
  );
  base.userData.arenaPart = 'base';
  base.position.y = -1.2;
  base.receiveShadow = true;
  base.castShadow = true;
  group.add(base);

  const supports = createRooftopSupports(skin);
  group.add(supports);

  const city = createRooftopCity(skin);
  group.add(city);

  // Battle dish — slightly recessed into the deck / ground.
  const dish = new THREE.Mesh(
    new THREE.CircleGeometry(DISH_RADIUS, 80),
    new THREE.MeshStandardMaterial({
      map: createDishTexture(skin),
      roughness: skin.dishRoughness,
      metalness: skin.dishMetalness,
    })
  );
  dish.userData.arenaPart = 'dish';
  dish.rotation.x = -Math.PI / 2;
  dish.position.y = floorY - DISH_RECESS;
  dish.receiveShadow = true;
  dish.castShadow = false;
  group.add(dish);

  const dishLip = new THREE.Mesh(
    new THREE.RingGeometry(DISH_RADIUS - 0.08, DISH_RADIUS + 0.16, 80),
    new THREE.MeshStandardMaterial({
      color: skin.dishLip,
      metalness: 0.45,
      roughness: 0.4,
      emissive: skin.dishLip,
      emissiveIntensity: 0.06,
    })
  );
  dishLip.userData.arenaPart = 'dishLip';
  dishLip.rotation.x = -Math.PI / 2;
  dishLip.position.y = floorY + 0.005;
  dishLip.castShadow = false;
  group.add(dishLip);

  const wallMat = new THREE.MeshStandardMaterial({
    color: skin.wall,
    metalness: skin.wallMetalness,
    roughness: skin.wallRoughness,
    emissive: skin.wallEmissive,
    emissiveIntensity: skin.wallEmissiveIntensity,
  });
  addWallSegments(group, wallMat);

  const parts = {
    ground,
    platform,
    base,
    supports,
    city,
    dish,
    dishLip,
    wallMat,
    sky,
  };
  group.userData.arenaParts = parts;
  applyPlacement(parts, skin);
  tintCityForSkin(city, skin);
  tintCityForSkin(supports, skin);

  scene.add(group);
  return group;
}
