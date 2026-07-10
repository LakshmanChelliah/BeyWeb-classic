import * as THREE from 'three';
import { CONFIG } from '../config.js';
import {
  DEFAULT_ARENA_SKIN_ID,
  getArenaSkin,
  resolveArenaSkinId,
} from './arenaSkins.js?v=43';
import { createBackdropTexture } from './arenaBackdrop.js?v=43';

/**
 * Stadium geometry is fixed. Skins only swap canvas textures, materials,
 * and the painted sky-dome backdrop — never radii, walls, or pocket layout.
 */

const DISH_RADIUS = CONFIG.WALL_RADIUS + 0.15;
const PLATFORM_OUTER_RADIUS = CONFIG.PLATFORM_OUTER_RADIUS;
const SKY_RADIUS = 95;

/** Soft radial gradient + anime gloss ring on the battle dish */
function createDishTexture(skin) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2;

  const grad = ctx.createRadialGradient(cx, cy * 0.85, r * 0.1, cx, cy, r);
  grad.addColorStop(0, skin.dishCenter);
  grad.addColorStop(0.7, skin.dishMid);
  grad.addColorStop(1, skin.dishEdge);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Specular-style gloss arc (anime overhead light).
  const gloss = ctx.createRadialGradient(cx * 0.78, cy * 0.55, r * 0.02, cx * 0.78, cy * 0.55, r * 0.45);
  gloss.addColorStop(0, 'rgba(255,255,255,0.28)');
  gloss.addColorStop(0.45, 'rgba(255,255,255,0.08)');
  gloss.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gloss;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Lane ring etch
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.38, 0, Math.PI * 2);
  ctx.stroke();

  if (skin.dishAccent) {
    ctx.strokeStyle = skin.dishAccent;
    for (let i = 0; i < 12; i++) {
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.globalAlpha = 0.2 + Math.random() * 0.25;
      const a0 = Math.random() * Math.PI * 2;
      const a1 = a0 + (Math.random() - 0.5) * 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a0) * r * 0.15, cy + Math.sin(a0) * r * 0.15);
      ctx.quadraticCurveTo(
        cx + Math.cos((a0 + a1) / 2) * r * (0.4 + Math.random() * 0.3),
        cy + Math.sin((a0 + a1) / 2) * r * (0.4 + Math.random() * 0.3),
        cx + Math.cos(a1) * r * 0.92,
        cy + Math.sin(a1) * r * 0.92
      );
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Light marble / tiled platform texture from skin palette */
function createPlatformTexture(skin) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = skin.platformBase;
  ctx.fillRect(0, 0, size, size);

  ctx.strokeStyle = skin.platformVein;
  for (let i = 0; i < 50; i++) {
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.globalAlpha = 0.25 + Math.random() * 0.25;
    ctx.beginPath();
    ctx.moveTo(Math.random() * size, Math.random() * size);
    ctx.bezierCurveTo(
      Math.random() * size,
      Math.random() * size,
      Math.random() * size,
      Math.random() * size,
      Math.random() * size,
      Math.random() * size
    );
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const tile = size / 4;
  ctx.strokeStyle = skin.platformGrid;
  ctx.lineWidth = 4;
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

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

function disposeMap(mat) {
  if (mat?.map) {
    mat.map.dispose();
    mat.map = null;
  }
}

/** Trapezoidal wedge cross-section: ramps up from the dish to a flat top */
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

/**
 * Navy wedge wall segments following each arc between the KO pockets.
 * Geometry is identical for every skin; only the shared material is skinned.
 */
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

function createSkyDome(skin) {
  const mat = new THREE.MeshBasicMaterial({
    map: createBackdropTexture(skin),
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(SKY_RADIUS, 48, 24), mat);
  dome.userData.arenaPart = 'sky';
  dome.renderOrder = -10;
  return dome;
}

function applySkinToParts(parts, skin) {
  disposeMap(parts.platform.material);
  const platformMap = createPlatformTexture(skin);
  platformMap.needsUpdate = true;
  parts.platform.material.map = platformMap;
  parts.platform.material.color?.setHex?.(0xffffff);
  parts.platform.material.roughness = skin.platformRoughness;
  parts.platform.material.metalness = skin.platformMetalness;
  parts.platform.material.needsUpdate = true;

  disposeMap(parts.dish.material);
  const dishMap = createDishTexture(skin);
  dishMap.needsUpdate = true;
  parts.dish.material.map = dishMap;
  parts.dish.material.color?.setHex?.(0xffffff);
  parts.dish.material.roughness = skin.dishRoughness;
  parts.dish.material.metalness = skin.dishMetalness;
  parts.dish.material.needsUpdate = true;

  parts.dishLip.material.color.setHex(skin.dishLip);
  parts.dishLip.material.metalness = 0.72;
  parts.dishLip.material.roughness = 0.22;
  parts.dishLip.material.emissive.setHex(skin.dishLip);
  parts.dishLip.material.emissiveIntensity = 0.18;
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

  parts.base.material.color.setHex(skin.base);
  parts.base.material.needsUpdate = true;

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

/**
 * Re-skin an existing arena group without rebuilding geometry.
 * @param {THREE.Group} group
 * @param {string} skinId
 */
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
 * Flat physics arena with anime venue skins:
 * glossy battle dish, wedge walls with three KO gaps,
 * barrier ring, tiled platform, and painted sky dome.
 *
 * Shape/format is constant; `skinId` only changes textures and materials.
 */
export function createArenaMesh(scene, skinId = resolveArenaSkinId()) {
  const skin = getArenaSkin(skinId ?? DEFAULT_ARENA_SKIN_ID);
  const group = new THREE.Group();
  group.userData.arenaSkinId = skin.id;
  group.userData.scene = scene;
  applySceneAmbience(scene, skin);

  const sky = createSkyDome(skin);
  group.add(sky);

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
  platform.position.y = CONFIG.FLOOR_Y - 0.04;
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
      metalness: 0.72,
      roughness: 0.22,
      emissive: skin.dishLip,
      emissiveIntensity: 0.18,
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

  const barrier = new THREE.Mesh(
    new THREE.CylinderGeometry(
      PLATFORM_OUTER_RADIUS,
      PLATFORM_OUTER_RADIUS,
      1.1,
      80,
      1,
      true
    ),
    new THREE.MeshStandardMaterial({
      color: skin.barrier,
      metalness: skin.barrierMetalness,
      roughness: skin.barrierRoughness,
      side: THREE.DoubleSide,
    })
  );
  barrier.userData.arenaPart = 'barrier';
  barrier.position.y = 0.55;
  group.add(barrier);

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(
      PLATFORM_OUTER_RADIUS - 0.3,
      PLATFORM_OUTER_RADIUS + 0.5,
      0.7,
      80
    ),
    new THREE.MeshStandardMaterial({
      color: skin.base,
      metalness: 0.2,
      roughness: 0.85,
    })
  );
  base.userData.arenaPart = 'base';
  base.position.y = -0.5;
  base.receiveShadow = true;
  group.add(base);

  group.userData.arenaParts = {
    platform,
    dish,
    dishLip,
    wallMat,
    barrier,
    base,
    sky,
  };

  scene.add(group);
  return group;
}
