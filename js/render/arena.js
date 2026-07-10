import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  DEFAULT_ARENA_SKIN_ID,
  getArenaSkin,
  resolveArenaSkinId,
} from './arenaSkins.js?v=44';
import { createBackdropTexture } from './arenaBackdrop.js?v=44';

/**
 * Stadium battle geometry is fixed (dish / walls / pockets).
 * Venue skins swap materials plus a large level ground plane so the arena
 * sits on the floor — never floating over empty sky.
 */

const DISH_RADIUS = CONFIG.WALL_RADIUS + 0.15;
const PLATFORM_OUTER_RADIUS = CONFIG.PLATFORM_OUTER_RADIUS;
/** Out-of-bounds ground flush with the stadium floor. */
const GROUND_RADIUS = 72;
const SKY_RADIUS = 90;

function createDishTexture(skin) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const grad = ctx.createRadialGradient(cx, cy * 0.85, r * 0.08, cx, cy, r);
  grad.addColorStop(0, skin.dishCenter);
  grad.addColorStop(0.65, skin.dishMid);
  grad.addColorStop(1, skin.dishEdge);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Clean lane rings (readable, not noisy).
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 4;
  for (const rr of [0.35, 0.58, 0.82]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * rr, 0, Math.PI * 2);
    ctx.stroke();
  }

  // Soft overhead gloss.
  const gloss = ctx.createRadialGradient(cx * 0.75, cy * 0.55, 4, cx * 0.75, cy * 0.55, r * 0.4);
  gloss.addColorStop(0, 'rgba(255,255,255,0.22)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  if (skin.dishAccent) {
    ctx.strokeStyle = skin.dishAccent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r * 0.2, cy + Math.sin(a) * r * 0.2);
      ctx.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Inner stadium platform (between dish and barrier). */
function createPlatformTexture(skin) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);

  const tile = size / 6;
  ctx.strokeStyle = skin.platformGrid;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.7;
  for (let i = 0; i <= 6; i++) {
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
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

/**
 * Large out-of-bounds ground — must read as the venue floor
 * (concrete, sand, asphalt, rock, lava…) level with the stadium.
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

  switch (style) {
    case 'construction':
      paintGroundConstruction(ctx, size, skin);
      break;
    case 'survival_island':
      paintGroundSand(ctx, size, skin);
      break;
    case 'wbba_hq':
      paintGroundPolished(ctx, size, skin);
      break;
    case 'rooftop_day':
      paintGroundRooftop(ctx, size, skin);
      break;
    case 'koma_village':
      paintGroundStone(ctx, size, skin);
      break;
    case 'dn_rooftop_night':
      paintGroundRooftopNight(ctx, size, skin);
      break;
    case 'city_streets':
      paintGroundAsphalt(ctx, size, skin);
      break;
    case 'volcano':
      paintGroundLavaRock(ctx, size, skin);
      break;
    default:
      paintGroundStone(ctx, size, skin);
  }

  // Fade slightly toward edges so it blends into fog/horizon.
  const fade = ctx.createRadialGradient(size / 2, size / 2, size * 0.28, size / 2, size / 2, size * 0.5);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  return tex;
}

function paintGroundConstruction(ctx, size, skin) {
  // Concrete slabs
  const tile = size / 4;
  ctx.strokeStyle = skin.platformGrid || '#504840';
  ctx.lineWidth = 6;
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
  // Hazard stripes
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 10;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 8; i++) {
    const y = 40 + i * 120;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(size, y + 80);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Rebar dots
  ctx.fillStyle = '#6a4030';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.arc(Math.random() * size, Math.random() * size, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintGroundSand(ctx, size, skin) {
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 120; i++) {
    ctx.globalAlpha = 0.08 + Math.random() * 0.12;
    ctx.fillStyle = Math.random() > 0.5 ? '#fff6d8' : '#b89560';
    ctx.beginPath();
    ctx.ellipse(
      Math.random() * size,
      Math.random() * size,
      20 + Math.random() * 60,
      8 + Math.random() * 18,
      Math.random() * Math.PI,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function paintGroundPolished(ctx, size, skin) {
  const tile = size / 8;
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = skin.platformGrid;
  ctx.lineWidth = 2;
  for (let i = 0; i <= 8; i++) {
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
  // Gloss tiles alternate
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      if ((x + y) % 2 === 0) ctx.fillRect(x * tile, y * tile, tile, tile);
    }
  }
}

function paintGroundRooftop(ctx, size, skin) {
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  // Tar seams
  ctx.strokeStyle = skin.platformGrid;
  ctx.lineWidth = 5;
  for (let i = 0; i < 6; i++) {
    const p = ((i + 1) / 7) * size;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }
  // Roof vents as small rectangles
  ctx.fillStyle = '#5a5048';
  for (let i = 0; i < 12; i++) {
    ctx.fillRect(Math.random() * size, Math.random() * size, 28, 18);
  }
}

function paintGroundStone(ctx, size, skin) {
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = skin.platformGrid;
  ctx.lineWidth = 3;
  // Irregular flagstones
  for (let i = 0; i < 35; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const w = 40 + Math.random() * 80;
    const h = 30 + Math.random() * 60;
    ctx.strokeRect(x, y, w, h);
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = skin.platformVein;
    ctx.fillRect(x, y, w, h);
    ctx.globalAlpha = 1;
  }
}

function paintGroundRooftopNight(ctx, size, skin) {
  paintGroundRooftop(ctx, size, skin);
  ctx.fillStyle = 'rgba(80,20,40,0.15)';
  ctx.fillRect(0, 0, size, size);
}

function paintGroundAsphalt(ctx, size, skin) {
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  // Road noise
  for (let i = 0; i < 200; i++) {
    ctx.globalAlpha = 0.08;
    ctx.fillStyle = Math.random() > 0.5 ? '#666' : '#222';
    ctx.fillRect(Math.random() * size, Math.random() * size, 3, 3);
  }
  ctx.globalAlpha = 1;
  // Lane markings
  ctx.strokeStyle = '#f8fafc';
  ctx.lineWidth = 8;
  ctx.setLineDash([40, 30]);
  ctx.beginPath();
  ctx.moveTo(size * 0.5, 0);
  ctx.lineTo(size * 0.5, size);
  ctx.stroke();
  ctx.setLineDash([]);
  // Crosswalk
  ctx.fillStyle = 'rgba(248,250,252,0.55)';
  for (let i = 0; i < 8; i++) {
    ctx.fillRect(size * 0.2 + i * 40, size * 0.7, 18, 70);
  }
}

function paintGroundLavaRock(ctx, size, skin) {
  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);
  // Cracks
  ctx.strokeStyle = skin.dishAccent || '#dc2626';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 24; i++) {
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.quadraticCurveTo(
      Math.random() * size,
      Math.random() * size,
      Math.random() * size,
      Math.random() * size
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  // Ember spots
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 18);
    g.addColorStop(0, 'rgba(255,80,0,0.55)');
    g.addColorStop(1, 'rgba(255,80,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, 18, 0, Math.PI * 2);
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
      wall.position.set(x, 0.02, z);
      wall.rotation.y = -angle;
      wall.castShadow = true;
      wall.receiveShadow = true;
      group.add(wall);
    }
  }
}

/** Horizon sky only — upper dome so the ground plane owns the floor. */
function createSkyDome(skin) {
  const mat = new THREE.MeshBasicMaterial({
    map: createBackdropTexture(skin),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  // Hemisphere covers the sky; ground plane covers below.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(SKY_RADIUS, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.52),
    mat
  );
  dome.userData.arenaPart = 'sky';
  dome.position.y = 0;
  dome.renderOrder = -10;
  return dome;
}

function applySkinToParts(parts, skin) {
  disposeMap(parts.ground.material);
  const groundMap = createGroundTexture(skin);
  groundMap.needsUpdate = true;
  parts.ground.material.map = groundMap;
  parts.ground.material.color.setHex(0xffffff);
  parts.ground.material.roughness = Math.min(0.95, (skin.platformRoughness ?? 0.6) + 0.15);
  parts.ground.material.metalness = Math.max(0.02, (skin.platformMetalness ?? 0.1) * 0.5);
  parts.ground.material.needsUpdate = true;

  disposeMap(parts.platform.material);
  const platformMap = createPlatformTexture(skin);
  platformMap.needsUpdate = true;
  parts.platform.material.map = platformMap;
  parts.platform.material.color.setHex(0xffffff);
  parts.platform.material.roughness = skin.platformRoughness;
  parts.platform.material.metalness = skin.platformMetalness;
  parts.platform.material.needsUpdate = true;

  disposeMap(parts.dish.material);
  const dishMap = createDishTexture(skin);
  dishMap.needsUpdate = true;
  parts.dish.material.map = dishMap;
  parts.dish.material.color.setHex(0xffffff);
  parts.dish.material.roughness = skin.dishRoughness;
  parts.dish.material.metalness = skin.dishMetalness;
  parts.dish.material.needsUpdate = true;

  parts.dishLip.material.color.setHex(skin.dishLip);
  parts.dishLip.material.metalness = 0.65;
  parts.dishLip.material.roughness = 0.28;
  parts.dishLip.material.emissive.setHex(skin.dishLip);
  parts.dishLip.material.emissiveIntensity = 0.12;
  parts.dishLip.material.needsUpdate = true;

  parts.wallMat.color.setHex(skin.wall);
  parts.wallMat.emissive.setHex(skin.wallEmissive);
  parts.wallMat.emissiveIntensity = skin.wallEmissiveIntensity;
  parts.wallMat.metalness = skin.wallMetalness;
  parts.wallMat.roughness = skin.wallRoughness;
  parts.wallMat.needsUpdate = true;

  parts.barrier.material.color.setHex(skin.barrier);
  parts.barrier.material.metalness = skin.barrierMetalness;
  parts.barrier.material.roughness = skin.barrierRoughness;
  parts.barrier.material.needsUpdate = true;

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
 * Grounded anime venue arena:
 * large level ground plane + battle dish/walls + horizon sky.
 * Stadium shape stays fixed; skins only change look.
 */
export function createArenaMesh(scene, skinId = resolveArenaSkinId()) {
  const skin = getArenaSkin(skinId ?? DEFAULT_ARENA_SKIN_ID);
  const group = new THREE.Group();
  group.userData.arenaSkinId = skin.id;
  group.userData.scene = scene;
  applySceneAmbience(scene, skin);

  const sky = createSkyDome(skin);
  group.add(sky);

  // Level out-of-bounds ground — stadium sits ON this, not floating above sky.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(GROUND_RADIUS, 96),
    new THREE.MeshStandardMaterial({
      map: createGroundTexture(skin),
      roughness: Math.min(0.95, (skin.platformRoughness ?? 0.6) + 0.15),
      metalness: Math.max(0.02, (skin.platformMetalness ?? 0.1) * 0.5),
    })
  );
  ground.userData.arenaPart = 'ground';
  ground.rotation.x = -Math.PI / 2;
  // Flush with the battle floor so OOB reads as continuous ground, not a floating pad.
  ground.position.y = CONFIG.FLOOR_Y - 0.01;
  ground.receiveShadow = true;
  group.add(ground);

  const platform = new THREE.Mesh(
    new THREE.CircleGeometry(PLATFORM_OUTER_RADIUS, 80),
    new THREE.MeshStandardMaterial({
      map: createPlatformTexture(skin),
      roughness: skin.platformRoughness,
      metalness: skin.platformMetalness,
    })
  );
  platform.userData.arenaPart = 'platform';
  platform.rotation.x = -Math.PI / 2;
  platform.position.y = CONFIG.FLOOR_Y - 0.02;
  platform.receiveShadow = true;
  group.add(platform);

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
  dish.position.y = CONFIG.FLOOR_Y + 0.02;
  dish.receiveShadow = true;
  group.add(dish);

  const dishLip = new THREE.Mesh(
    new THREE.RingGeometry(DISH_RADIUS - 0.18, DISH_RADIUS + 0.05, 80),
    new THREE.MeshStandardMaterial({
      color: skin.dishLip,
      metalness: 0.65,
      roughness: 0.28,
      emissive: skin.dishLip,
      emissiveIntensity: 0.12,
    })
  );
  dishLip.userData.arenaPart = 'dishLip';
  dishLip.rotation.x = -Math.PI / 2;
  dishLip.position.y = CONFIG.FLOOR_Y + 0.035;
  group.add(dishLip);

  const wallMat = new THREE.MeshStandardMaterial({
    color: skin.wall,
    metalness: skin.wallMetalness,
    roughness: skin.wallRoughness,
    emissive: skin.wallEmissive,
    emissiveIntensity: skin.wallEmissiveIntensity,
  });
  addWallSegments(group, wallMat);

  // Low ring only — no tall floating cylinder wall.
  const barrier = new THREE.Mesh(
    new THREE.TorusGeometry(PLATFORM_OUTER_RADIUS - 0.15, 0.18, 10, 80),
    new THREE.MeshStandardMaterial({
      color: skin.barrier,
      metalness: skin.barrierMetalness,
      roughness: skin.barrierRoughness,
    })
  );
  barrier.userData.arenaPart = 'barrier';
  barrier.rotation.x = Math.PI / 2;
  barrier.position.y = CONFIG.FLOOR_Y + 0.12;
  group.add(barrier);

  group.userData.arenaParts = {
    ground,
    platform,
    dish,
    dishLip,
    wallMat,
    barrier,
    sky,
  };

  scene.add(group);
  return group;
}
