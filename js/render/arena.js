import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  DEFAULT_ARENA_SKIN_ID,
  getArenaSkin,
  resolveArenaSkinId,
} from './arenaSkins.js?v=66';
import { createBackdropTexture } from './arenaBackdrop.js?v=66';
import { setArenaCameraCeiling } from './scene.js';

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
/** How far the dish rim sits below the surrounding floor. */
const DISH_RECESS = 0.04;
/** Visual bowl depth (center below rim) — shallow so tops don’t float. */
const DISH_BOWL_DEPTH = 0.62;

/**
 * Shallow concave dish (lathed parabola). Same outer radius as the old flat circle;
 * battle physics / wall radius unchanged.
 */
function createBowlGeometry(radius = DISH_RADIUS, depth = DISH_BOWL_DEPTH, segments = 64) {
  const pts = [];
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = t * radius;
    // Parabolic bowl: center at -depth, rim at 0.
    const y = -depth * (1 - t * t);
    pts.push(new THREE.Vector2(x, y));
  }
  const geo = new THREE.LatheGeometry(pts, segments);

  // Lathe winds so normals face downward for this profile — flip for an upward bowl.
  const index = geo.index;
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
    index.needsUpdate = true;
  }

  // Rebuild UVs, upward normals, and vertex colors so the bowl reads from fight cam.
  const uv = geo.attributes.uv;
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const r2 = radius * radius;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i);
    const pz = pos.getZ(i);
    const rho = Math.hypot(px, pz);
    const t = Math.min(1, rho / radius);
    uv.setXY(i, 0.5 + px / (2 * radius), 0.5 + pz / (2 * radius));

    // Explicit upward normals for y = -depth*(1-(ρ/R)^2): ∂y/∂ρ = 2·depth·ρ/R².
    if (rho < 1e-5) {
      nrm.setXYZ(i, 0, 1, 0);
    } else {
      const dy = (2 * depth * rho) / r2;
      const nx = -dy * (px / rho);
      const nz = -dy * (pz / rho);
      const len = Math.hypot(nx, 1, nz) || 1;
      nrm.setXYZ(i, nx / len, 1 / len, nz / len);
    }

    // Concave shade: dark well → bright mid-slope → dark rim.
    let s;
    if (t < 0.28) s = 0.28 + (t / 0.28) * 0.4;
    else if (t < 0.68) s = 0.68 + ((t - 0.28) / 0.4) * 0.32;
    else s = 1.0 - ((t - 0.68) / 0.32) * 0.78;
    colors[i * 3] = s;
    colors[i * 3 + 1] = s;
    colors[i * 3 + 2] = s;
  }
  uv.needsUpdate = true;
  nrm.needsUpdate = true;
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return geo;
}

/** Dish material that keeps baked bowl shading visible under venue lights. */
function createDishMaterial(skin, dishMap) {
  return new THREE.MeshStandardMaterial({
    map: dishMap,
    emissiveMap: dishMap,
    emissive: new THREE.Color(0xffffff),
    emissiveIntensity: 0.42,
    vertexColors: true,
    side: THREE.DoubleSide,
    roughness: Math.max(skin.dishRoughness ?? 0.55, 0.7),
    metalness: 0,
  });
}

function applyDishMaterialProps(mat, skin, dishMap) {
  mat.map = dishMap;
  mat.emissiveMap = dishMap;
  mat.emissive.setHex(0xffffff);
  mat.emissiveIntensity = 0.42;
  mat.vertexColors = true;
  mat.side = THREE.DoubleSide;
  mat.color.setHex(0xffffff);
  mat.roughness = Math.max(skin.dishRoughness ?? 0.55, 0.7);
  mat.metalness = 0;
  mat.needsUpdate = true;
}

function isElevated(skin) {
  return skin?.placement === 'elevated';
}

function isWbba(skin) {
  return skin?.backdrop?.style === 'wbba_hq';
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

  // Concave bowl shading — high-contrast so it reads on mobile, not a flat pad.
  const grad = ctx.createRadialGradient(cx, cy, r * 0.02, cx, cy, r);
  grad.addColorStop(0, shadeHex(skin.dishCenter, 0.55));
  grad.addColorStop(0.12, shadeHex(skin.dishCenter, 0.7));
  grad.addColorStop(0.32, skin.dishCenter);
  grad.addColorStop(0.52, skin.dishMid);
  grad.addColorStop(0.72, skin.dishEdge);
  grad.addColorStop(0.88, shadeHex(skin.dishEdge, 0.42));
  grad.addColorStop(1, shadeHex(skin.dishEdge, 0.22));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Deep center well (recessed pit).
  const well = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.48);
  well.addColorStop(0, 'rgba(0,0,0,0.55)');
  well.addColorStop(0.4, 'rgba(0,0,0,0.28)');
  well.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = well;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Lit mid-slope ring (curvature).
  const slope = ctx.createRadialGradient(cx, cy, r * 0.3, cx, cy, r * 0.72);
  slope.addColorStop(0, 'rgba(255,255,255,0)');
  slope.addColorStop(0.4, 'rgba(255,255,255,0.2)');
  slope.addColorStop(0.75, 'rgba(255,255,255,0.06)');
  slope.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = slope;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Heavy rim occlusion under the lip.
  const rim = ctx.createRadialGradient(cx, cy, r * 0.55, cx, cy, r);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(0.35, 'rgba(0,0,0,0.25)');
  rim.addColorStop(0.7, 'rgba(0,0,0,0.55)');
  rim.addColorStop(1, 'rgba(0,0,0,0.82)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Concentric contour rings.
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 4;
  for (const rr of [0.18, 0.34, 0.5, 0.66, 0.8, 0.9]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * rr, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.97, 0, Math.PI * 2);
  ctx.stroke();

  // Specular highlight on the near slope.
  const gloss = ctx.createRadialGradient(cx * 0.66, cy * 0.58, 2, cx * 0.66, cy * 0.58, r * 0.34);
  gloss.addColorStop(0, 'rgba(255,255,255,0.3)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.1)');
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
      paintFloorWbbaGold(ctx, size, skin);
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

/** Metal Fusion WBBA — polished gold platform panels. */
function paintFloorWbbaGold(ctx, size, skin) {
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.05, size / 2, size / 2, size * 0.55);
  g.addColorStop(0, skin.platformBase || '#d4a84a');
  g.addColorStop(0.55, skin.platformVein || '#c49838');
  g.addColorStop(1, skin.platformGrid || '#a87828');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  const divisions = 6;
  const tile = size / divisions;
  ctx.strokeStyle = 'rgba(80,50,10,0.35)';
  ctx.lineWidth = 4;
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
  // Specular sheen
  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0, 'rgba(255,240,200,0.28)');
  sheen.addColorStop(0.45, 'rgba(255,240,200,0)');
  sheen.addColorStop(1, 'rgba(255,220,140,0.18)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);
}

function createWbbaTealTexture(skin) {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const base = skin.tealFloor || '#2a9aaa';
  const dark = skin.tealFloorDark || '#1e7888';
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  const divisions = 8;
  const tile = size / divisions;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 3;
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
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < divisions; y++) {
    for (let x = 0; x < divisions; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
  const gloss = ctx.createRadialGradient(size * 0.35, size * 0.3, 10, size * 0.35, size * 0.3, size * 0.5);
  gloss.addColorStop(0, 'rgba(180,240,255,0.22)');
  gloss.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gloss;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
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
  if (!mat) return;
  const map = mat.map;
  const emissiveMap = mat.emissiveMap;
  if (map) map.dispose();
  if (emissiveMap && emissiveMap !== map) emissiveMap.dispose();
  mat.map = null;
  mat.emissiveMap = null;
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
  // Sit walls higher so the near-camera arc still reads from the fight cam.
  const wallEmbedY = -0.12;
  const wallTopY = wallEmbedY + CONFIG.WALL_HEIGHT * 0.9;
  const capMat = wallMat.clone();
  capMat.emissiveIntensity = Math.max(wallMat.emissiveIntensity ?? 0, 0.22);

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

      // Top rail — visible from overhead so the near KO border never “disappears”.
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(1.15, 0.14, segDepth * 0.92),
        capMat
      );
      cap.userData.arenaPart = 'wall';
      cap.position.set(x, wallTopY + 0.02, z);
      cap.rotation.y = -angle;
      cap.castShadow = false;
      group.add(cap);
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
  const wbba = isWbba(skin);
  // Huge open ground only for outdoor ground venues — not WBBA (indoor bowl).
  if (parts.ground) parts.ground.visible = !elevated && !wbba;
  if (parts.plaza) parts.plaza.visible = wbba;
  if (parts.wbbaBowl) parts.wbbaBowl.visible = wbba;
  if (parts.platform) parts.platform.visible = elevated;
  if (parts.base) parts.base.visible = elevated;
  if (parts.supports) parts.supports.visible = elevated;
  if (parts.city) parts.city.visible = elevated;
  // Ceiling at y=48; keep fight camera under it on zoom-out / specials.
  setArenaCameraCeiling(wbba ? 38 : null);
}

/**
 * Metal Fusion WBBA HQ: raised gold platform (dish flush on top), teal floor
 * below the curb, packed stands + jumbotrons. Fight camera looks into the dish.
 */
function createWbbaBowl(skin) {
  const group = new THREE.Group();
  group.userData.arenaPart = 'wbbaBowl';

  const goldR = PLATFORM_OUTER_RADIUS;
  const platformH = 1.3;
  const tealY = -platformH;
  const standsInner = goldR + 9;
  // Fight cam approaches on +Z — leave that sector open on curb / stands.
  const camGap = 1.7;
  const thetaStart = Math.PI / 2 + camGap / 2;
  const thetaLength = Math.PI * 2 - camGap;

  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf0c45a,
    metalness: 0.3,
    roughness: 0.38,
    emissive: 0xc49220,
    emissiveIntensity: 0.22,
  });
  const goldDarkMat = new THREE.MeshStandardMaterial({
    color: 0xb88828,
    metalness: 0.35,
    roughness: 0.42,
    emissive: 0x8a6010,
    emissiveIntensity: 0.1,
  });
  const seatMatA = new THREE.MeshStandardMaterial({
    color: 0x1a2230,
    roughness: 0.72,
    metalness: 0.08,
  });
  const seatMatB = new THREE.MeshStandardMaterial({
    color: 0x121820,
    roughness: 0.72,
    metalness: 0.08,
  });
  const crowdMats = [
    new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0x1e3a5f, roughness: 0.85 }),
    new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.8 }),
    new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.75 }),
    new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 }),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.85 }),
  ];
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xd4b898,
    roughness: 0.92,
    metalness: 0,
  });
  const beamMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    metalness: 0.55,
    roughness: 0.4,
  });
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x67e8f9,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.85,
    roughness: 0.25,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const screenFrameMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.5,
    roughness: 0.4,
  });

  // Raised gold platform curb — thick disc on teal floor, open on camera arc
  const curb = new THREE.Mesh(
    new THREE.CylinderGeometry(
      goldR,
      goldR + 0.15,
      platformH,
      80,
      1,
      true,
      thetaStart,
      thetaLength
    ),
    goldMat
  );
  curb.position.y = tealY + platformH * 0.5;
  curb.castShadow = true;
  curb.receiveShadow = true;
  group.add(curb);
  // Bottom lip where curb meets teal
  const curbLip = new THREE.Mesh(
    new THREE.TorusGeometry(goldR + 0.08, 0.12, 8, 64),
    goldDarkMat
  );
  curbLip.rotation.x = Math.PI / 2;
  curbLip.position.y = tealY + 0.08;
  group.add(curbLip);
  // Outer top edge highlight on gold platform
  const goldEdge = new THREE.Mesh(
    new THREE.TorusGeometry(goldR - 0.05, 0.08, 8, 64),
    goldDarkMat
  );
  goldEdge.rotation.x = Math.PI / 2;
  goldEdge.position.y = 0.02;
  group.add(goldEdge);

  // Teal stadium floor from gold curb out to the stands
  const tealMap = createWbbaTealTexture(skin);
  const tealFloor = new THREE.Mesh(
    new THREE.RingGeometry(goldR + 0.05, standsInner + 1.5, 80),
    new THREE.MeshStandardMaterial({
      map: tealMap,
      color: 0xffffff,
      roughness: 0.28,
      metalness: 0.22,
    })
  );
  tealFloor.rotation.x = -Math.PI / 2;
  tealFloor.position.y = tealY;
  tealFloor.receiveShadow = true;
  group.add(tealFloor);

  // Steep packed stands — leave a clear +Z camera corridor (fight cam / zoom).
  const tiers = 10;
  const bodyGeo = new THREE.BoxGeometry(0.34, 0.68, 0.26);
  const headGeo = new THREE.SphereGeometry(0.13, 5, 5);
  const dummy = new THREE.Object3D();
  const seatSegments = 64;

  for (let t = 0; t < tiers; t++) {
    const r0 = standsInner + t * 1.65;
    const r1 = r0 + 1.5;
    const y = tealY + 0.7 + t * 1.4;
    const seat = new THREE.Mesh(
      new THREE.RingGeometry(r0, r1, seatSegments, 1, thetaStart, thetaLength),
      t % 2 === 0 ? seatMatA : seatMatB
    );
    seat.rotation.x = -Math.PI / 2;
    seat.position.y = y;
    seat.receiveShadow = true;
    group.add(seat);

    const riser = new THREE.Mesh(
      new THREE.CylinderGeometry(r0, r0, 1.35, seatSegments, 1, true, thetaStart, thetaLength),
      t % 2 === 0 ? seatMatB : seatMatA
    );
    riser.position.y = y - 0.65;
    group.add(riser);

    const crowdCount = 120 + t * 16;
    const perMat = Math.ceil(crowdCount / crowdMats.length);
    const bodyMeshes = crowdMats.map(
      (mat) => new THREE.InstancedMesh(bodyGeo, mat, perMat)
    );
    const headMesh = new THREE.InstancedMesh(headGeo, headMat, crowdCount);
    const bodyIdx = new Array(crowdMats.length).fill(0);
    let headIdx = 0;

    for (let i = 0; i < crowdCount; i++) {
      const a = thetaStart + ((i + 0.5) / crowdCount) * thetaLength + (t % 2) * 0.02;
      const rr = (r0 + r1) * 0.5 + ((i % 5) - 2) * 0.1;
      const bx = Math.cos(a) * rr;
      const bz = Math.sin(a) * rr;
      const mi = i % crowdMats.length;

      dummy.position.set(bx, y + 0.42, bz);
      dummy.rotation.set(0, -a + Math.PI, 0);
      dummy.scale.setScalar(0.85 + (i % 4) * 0.06);
      dummy.updateMatrix();
      bodyMeshes[mi].setMatrixAt(bodyIdx[mi]++, dummy.matrix);

      dummy.position.set(bx, y + 0.86, bz);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      headMesh.setMatrixAt(headIdx++, dummy.matrix);
    }

    bodyMeshes.forEach((mesh, mi) => {
      mesh.count = bodyIdx[mi];
      mesh.instanceMatrix.needsUpdate = true;
      group.add(mesh);
    });
    headMesh.count = headIdx;
    headMesh.instanceMatrix.needsUpdate = true;
    group.add(headMesh);
  }

  const topR = standsInner + (tiers - 1) * 1.65 + 1.5;
  // Keep overhead well above fight camera (~y24) and mobile zoom-out (~y36).
  const ceilingY = 48;
  const canopyInner = 30;

  // No vertical support columns — they sat in the fight-cam lens on zoom/start.

  // Jumbotron screens — keep off the camera-facing arc
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    if (Math.sin(a) > 0.2) continue;
    const r = standsInner + 4.5;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 4.2, 0.35), screenFrameMat);
    frame.position.set(Math.cos(a) * r, 18, Math.sin(a) * r);
    frame.rotation.y = -a + Math.PI;
    group.add(frame);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 3.5), screenMat);
    screen.position.set(Math.cos(a) * (r - 0.22), 18, Math.sin(a) * (r - 0.22));
    screen.rotation.y = -a + Math.PI;
    group.add(screen);
  }

  // Floodlights on the outer canopy only — not hanging in the open center / cam arc
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    if (Math.sin(a) > 0.35) continue;
    const r = (canopyInner + topR) * 0.5;
    const fixture = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.4, 1.1),
      beamMat
    );
    fixture.position.set(Math.cos(a) * r, ceilingY - 0.6, Math.sin(a) * r);
    fixture.rotation.y = -a;
    group.add(fixture);
    const glow = new THREE.Mesh(
      new THREE.CircleGeometry(1.3, 16),
      new THREE.MeshBasicMaterial({
        color: 0xfff3c4,
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        side: THREE.DoubleSide,
      })
    );
    glow.rotation.x = Math.PI / 2;
    glow.position.set(Math.cos(a) * r, ceilingY - 0.9, Math.sin(a) * r);
    group.add(glow);
  }

  // Open-center canopy ring (wide hole so fight camera never hits fixtures)
  const canopy = new THREE.Mesh(
    new THREE.RingGeometry(canopyInner, topR + 2, 64),
    new THREE.MeshStandardMaterial({
      color: 0x0b1220,
      roughness: 0.85,
      metalness: 0.15,
      side: THREE.DoubleSide,
    })
  );
  canopy.rotation.x = -Math.PI / 2;
  canopy.position.y = ceilingY;
  group.add(canopy);

  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const len = topR - canopyInner + 2;
    const rafter = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, len), beamMat);
    rafter.position.set(
      Math.cos(a) * ((canopyInner + topR) * 0.5),
      ceilingY - 0.2,
      Math.sin(a) * ((canopyInner + topR) * 0.5)
    );
    rafter.rotation.y = -a;
    group.add(rafter);
  }

  // Soft overhead lamp glow high above the dish
  const lamp = new THREE.Mesh(
    new THREE.RingGeometry(8, 22, 32),
    new THREE.MeshBasicMaterial({
      color: 0xffe8b0,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
  );
  lamp.rotation.x = Math.PI / 2;
  lamp.position.y = ceilingY - 1.2;
  group.add(lamp);

  // Outer bowl shell
  const outerWall = new THREE.Mesh(
    new THREE.CylinderGeometry(topR + 1, topR + 0.6, ceilingY + 4, 72, 1, true),
    new THREE.MeshStandardMaterial({
      color: 0x0a1018,
      roughness: 0.9,
      metalness: 0.08,
      side: THREE.BackSide,
    })
  );
  outerWall.position.y = tealY + (ceilingY + 4) * 0.5;
  group.add(outerWall);

  return group;
}

function tintCityForSkin(city, skin) {
  if (!city) return;
  const night = skin.backdrop?.style === 'dn_rooftop_night';
  city.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mat = obj.material;
    if (obj.userData.cityPart === 'building') {
      mat.color.setHex(night ? 0x0e0a18 : 0x5a6878);
      mat.emissive?.setHex?.(night ? 0x3a1870 : 0x000000);
      mat.emissiveIntensity = night ? 0.18 : 0;
    } else if (obj.userData.cityPart === 'window') {
      mat.color.setHex(night ? 0x67e8f9 : 0xc8dce8);
      mat.emissive?.setHex?.(night ? 0x22d3ee : 0x88aacc);
      mat.emissiveIntensity = night ? 0.7 : 0.2;
    } else if (obj.userData.cityPart === 'support') {
      mat.color.setHex(night ? 0x2a1840 : 0x6a7888);
      mat.emissive?.setHex?.(night ? 0x5b21b6 : 0x000000);
      mat.emissiveIntensity = night ? 0.12 : 0;
      mat.metalness = night ? 0.75 : 0.65;
    } else if (obj.userData.cityPart === 'mist') {
      mat.color.setHex(0x4c1d95);
      mat.opacity = 0.55;
    }
  });
}

/**
 * Steel supports under the rooftop deck — reads as a stadium in the sky.
 */
function createRooftopSupports(skin) {
  const group = new THREE.Group();
  group.userData.arenaPart = 'supports';
  const night = skin.backdrop?.style === 'dn_rooftop_night';
  const steel = new THREE.MeshStandardMaterial({
    color: night ? 0x2a1840 : skin.base ?? 0x6a7888,
    metalness: 0.7,
    roughness: 0.32,
    emissive: night ? 0x5b21b6 : 0x000000,
    emissiveIntensity: night ? 0.1 : 0,
  });

  // Tall building shaft plunging into the mist / city below
  const shaftH = night ? 36 : 22;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(
      PLATFORM_OUTER_RADIUS * 0.5,
      PLATFORM_OUTER_RADIUS * (night ? 0.85 : 0.7),
      shaftH,
      24
    ),
    steel.clone()
  );
  shaft.userData.cityPart = 'support';
  shaft.position.y = -shaftH * 0.5 - 0.5;
  shaft.castShadow = true;
  shaft.receiveShadow = true;
  group.add(shaft);

  // Outer ring of pillars at the deck edge
  const pillarH = night ? 28 : 14;
  const pillarGeo = new THREE.BoxGeometry(0.85, pillarH, 0.85);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = PLATFORM_OUTER_RADIUS - 1.1;
    const pillar = new THREE.Mesh(pillarGeo, steel.clone());
    pillar.userData.cityPart = 'support';
    pillar.position.set(Math.cos(a) * r, -pillarH * 0.5 - 0.2, Math.sin(a) * r);
    pillar.castShadow = true;
    group.add(pillar);
  }

  // Diagonal braces under the deck
  const braceGeo = new THREE.BoxGeometry(0.4, night ? 16 : 10, 0.4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + 0.12;
    const r = PLATFORM_OUTER_RADIUS - 2.4;
    const brace = new THREE.Mesh(braceGeo, steel.clone());
    brace.userData.cityPart = 'support';
    brace.position.set(Math.cos(a) * r, night ? -9 : -5.5, Math.sin(a) * r);
    brace.rotation.z = (i % 2 === 0 ? 1 : -1) * 0.5;
    brace.rotation.y = -a;
    group.add(brace);
  }

  // Underside ring / lip
  const lip = new THREE.Mesh(
    new THREE.TorusGeometry(PLATFORM_OUTER_RADIUS - 0.4, 0.4, 8, 48),
    steel.clone()
  );
  lip.userData.cityPart = 'support';
  lip.rotation.x = Math.PI / 2;
  lip.position.y = -0.45;
  group.add(lip);

  // Night: cyan/purple mist bank far below the deck
  if (night) {
    const mistMat = new THREE.MeshBasicMaterial({
      color: 0x4c1d95,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    });
    const mist = new THREE.Mesh(new THREE.CircleGeometry(70, 48), mistMat);
    mist.userData.cityPart = 'mist';
    mist.rotation.x = -Math.PI / 2;
    mist.position.y = -28;
    group.add(mist);

    const mist2 = new THREE.Mesh(
      new THREE.CircleGeometry(55, 40),
      new THREE.MeshBasicMaterial({
        color: 0x0891b2,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
      })
    );
    mist2.userData.cityPart = 'mist';
    mist2.rotation.x = -Math.PI / 2;
    mist2.position.y = -24;
    group.add(mist2);
  }

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
    // Night: sink city deeper into mist so the deck feels ~1000m up.
    const yOff = night ? 32 : 18;
    building.position.set(
      Math.cos(s.a) * s.r,
      s.h * 0.5 - yOff,
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
      s.h * 0.5 - yOff,
      Math.sin(s.a) * (s.r - s.d * 0.52)
    );
    win.rotation.y = inward;
    group.add(win);
  }

  // Night signature towers — spiral HQ + orb tower taller than the stadium
  if (night) {
    const hq = new THREE.Mesh(
      new THREE.CylinderGeometry(2.5, 6, 58, 8),
      buildingMat.clone()
    );
    hq.userData.cityPart = 'building';
    hq.position.set(-34, 10, -30);
    group.add(hq);

    const orbPillarL = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, 40, 1.2),
      buildingMat.clone()
    );
    orbPillarL.userData.cityPart = 'building';
    orbPillarL.position.set(36, 4, 22);
    group.add(orbPillarL);
    const orbPillarR = orbPillarL.clone();
    orbPillarR.position.set(40, 4, 22);
    group.add(orbPillarR);

    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(4.5, 20, 16),
      new THREE.MeshStandardMaterial({
        color: 0x67e8f9,
        emissive: 0x22d3ee,
        emissiveIntensity: 0.85,
        metalness: 0.3,
        roughness: 0.25,
      })
    );
    orb.userData.cityPart = 'window';
    orb.position.set(38, 22, 22);
    group.add(orb);
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

  if (parts.plaza?.material) {
    disposeMap(parts.plaza.material);
    const plazaMap = createPlatformTexture(skin);
    plazaMap.needsUpdate = true;
    parts.plaza.material.map = plazaMap;
    const wbba = isWbba(skin);
    parts.plaza.material.color.setHex(wbba ? 0xffd56a : 0xffffff);
    parts.plaza.material.emissive?.setHex?.(wbba ? 0xc49220 : 0x000000);
    parts.plaza.material.emissiveIntensity = wbba ? 0.28 : 0;
    parts.plaza.material.roughness = skin.platformRoughness ?? (wbba ? 0.4 : 0.42);
    parts.plaza.material.metalness = skin.platformMetalness ?? (wbba ? 0.28 : 0.12);
    parts.plaza.material.needsUpdate = true;
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
  applyDishMaterialProps(parts.dish.material, skin, dishMap);

  parts.dishLip.material.color.setHex(skin.dishLip);
  parts.dishLip.material.metalness = isWbba(skin) ? 0.35 : 0.45;
  parts.dishLip.material.roughness = isWbba(skin) ? 0.35 : 0.4;
  parts.dishLip.material.emissive.setHex(skin.dishLip);
  parts.dishLip.material.emissiveIntensity = isWbba(skin) ? 0.22 : 0.06;
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

  // WBBA: gold platform top flush with dish rim (raised curb is in wbbaBowl).
  const plaza = new THREE.Mesh(
    new THREE.RingGeometry(DISH_RADIUS + 0.02, PLATFORM_OUTER_RADIUS, 80),
    new THREE.MeshStandardMaterial({
      map: createPlatformTexture(skin),
      color: isWbba(skin) ? 0xffd56a : 0xffffff,
      emissive: isWbba(skin) ? 0xc49220 : 0x000000,
      emissiveIntensity: isWbba(skin) ? 0.28 : 0,
      roughness: skin.platformRoughness ?? (isWbba(skin) ? 0.4 : 0.42),
      metalness: skin.platformMetalness ?? (isWbba(skin) ? 0.28 : 0.12),
    })
  );
  plaza.userData.arenaPart = 'plaza';
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.y = floorY;
  plaza.receiveShadow = true;
  plaza.castShadow = false;
  group.add(plaza);

  const wbbaBowl = createWbbaBowl(skin);
  group.add(wbbaBowl);

  // Elevated venues: rooftop deck with a hole so the battle bowl stays visible.
  const platform = new THREE.Mesh(
    new THREE.RingGeometry(DISH_RADIUS + 0.02, PLATFORM_OUTER_RADIUS, 80),
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

  // Battle dish — shallow 3D bowl (visual only; physics radii unchanged).
  const dishMap = createDishTexture(skin);
  const dish = new THREE.Mesh(
    createBowlGeometry(DISH_RADIUS, DISH_BOWL_DEPTH, 80),
    createDishMaterial(skin, dishMap)
  );
  dish.userData.arenaPart = 'dish';
  // Rim flush with floor recess; center dips by DISH_BOWL_DEPTH.
  dish.position.y = floorY - DISH_RECESS;
  dish.renderOrder = 2;
  dish.receiveShadow = true;
  dish.castShadow = false;
  group.add(dish);

  const dishLip = new THREE.Mesh(
    new THREE.RingGeometry(DISH_RADIUS - 0.08, DISH_RADIUS + 0.16, 80),
    new THREE.MeshStandardMaterial({
      color: skin.dishLip,
      metalness: isWbba(skin) ? 0.35 : 0.45,
      roughness: isWbba(skin) ? 0.35 : 0.4,
      emissive: skin.dishLip,
      emissiveIntensity: isWbba(skin) ? 0.22 : 0.06,
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
  addWallSegments(group, wallMat, skin);

  const parts = {
    ground,
    plaza,
    wbbaBowl,
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
