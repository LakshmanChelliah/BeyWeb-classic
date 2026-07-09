import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';
import {
  LDRAGO_ABSORB_COIL_DUR,
  LDRAGO_ABSORB_IMPACT_HOLD,
  LDRAGO_ABSORB_PIERCE_DUR,
  LDRAGO_SPIN_STEAL_DURATION,
} from '../game/abilities.js';
import {
  createBurstSystem,
  createTrailSystem,
  ensureQuarksRuntime,
  Vector4,
} from './vfx/quarksRuntime.js';
import {
  createDarkVortexTrail,
  createImpactShockwave,
  createSparkBurst,
  createSpeedTrail,
} from './vfx/presets.js';

function makeMat(color, opacity, { additive = false, doubleSide = false, map = null } = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    map,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
}

function createMatCache() {
  const cache = new Map();
  return (color, additive = false, doubleSide = false) => {
    const key = `${color}|${additive ? 1 : 0}|${doubleSide ? 1 : 0}`;
    if (!cache.has(key)) cache.set(key, makeMat(color, 0, { additive, doubleSide }));
    return cache.get(key);
  };
}

// Lightning L-Drago wears a purple/magenta accent (wiki) — palette names kept
// for diff history, but the constants are tuned to the new purple theme.
const CRIMSON = 0x5b21d9;   // primary dark violet
const RED_DEEP = 0x4510a8;  // saturated deep violet
const RED_DARK = 0x280f60;  // dark amethyst
const ORANGE = 0x7c3aed;    // lavender accent (formerly orange embers)
const PALE = 0xb794f4;      // pale lilac
const WHITE_HOT = 0xfaf5ff; // hot violet-tinted white

const DRAIN_COUNT = 28;
const EMBER_COUNT = 8;
const STEAL_BEAM_COUNT = 6;
const DRAGON_WING_COUNT = 6;
const HELIX_FLAME_COUNT = 28;
const WINDUP_OUT_DUST = 20;
const WINDUP_IN_GATHER = 16;
const ORBIT_EMBER_COUNT = 10;
const REPULSE_SPARK_COUNT = 28;
const WINDUP_CRATER_SPARKS = 18;
const REPULSE_SHEET_COUNT = 6;
const FLIGHT_COLUMN_HEIGHT = 4.2;

function rand(seed) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function buildTraits(count, kind) {
  const traits = [];
  for (let i = 0; i < count; i++) {
    const s = i + kind.charCodeAt(0) * 13;
    traits.push({
      phase: rand(s) * Math.PI * 2,
      speed: 0.6 + rand(s + 1) * 1.3,
      radius: 0.65 + rand(s + 2) * 0.45,
      height: rand(s + 3),
      sizeTier: Math.floor(rand(s + 4) * 3),
      size: kind === 'drain'
        ? 0.025 + rand(s + 4) * 0.055
        : kind === 'ember'
          ? 0.06 + rand(s + 4) * 0.1
          : kind === 'wing'
            ? 0.28 + rand(s + 4) * 0.22
            : kind === 'helix'
              ? 0.04 + rand(s + 4) * 0.07
              : 0.03 + rand(s + 4) * 0.05,
      colorPick: Math.floor(rand(s + 5) * 3),
      // Pre-baked heat band for helix strands — avoids per-frame material.color.setHex.
      heatBand: Math.floor(rand(s + 11) * 3),
    });
  }
  return traits;
}

const DRAIN_GEOS = [
  new THREE.PlaneGeometry(0.03, 0.026),
  new THREE.PlaneGeometry(0.045, 0.038),
  new THREE.PlaneGeometry(0.06, 0.05),
];
const HELIX_GEOS = [
  new THREE.PlaneGeometry(0.04, 0.1),
  new THREE.PlaneGeometry(0.055, 0.13),
  new THREE.PlaneGeometry(0.07, 0.16),
];
const EMBER_GEOS = [
  new THREE.PlaneGeometry(0.06, 0.06),
  new THREE.PlaneGeometry(0.08, 0.08),
  new THREE.PlaneGeometry(0.1, 0.1),
];
const HELIX_HEAT_COLORS = [WHITE_HOT, ORANGE, CRIMSON];
const BOLT_VIOLET = 0x9f8cf0;
const BOLT_GLOW = 0xfff7ed;
const LIGHTNING_SKY_Y = 26;
const LIGHTNING_BOLT_SPREAD = 2.85;
const STRIKE_MAIN_BOLT_COUNT = 8;
const STRIKE_BRANCH_BOLT_COUNT = 6;
const STRIKE_SIDE_BOLT_COUNT = 5;
const STRIKE_CHARGE_ARC_COUNT = 3;
const MAIN_BOLT_COLORS = [WHITE_HOT, BOLT_GLOW, BOLT_VIOLET, ORANGE, PALE, CRIMSON, WHITE_HOT, BOLT_GLOW];
const BRANCH_BOLT_COLORS = [BOLT_GLOW, CRIMSON, BOLT_VIOLET, ORANGE, PALE, WHITE_HOT];

function boltRand(seed) {
  return rand(seed) * 2 - 1;
}

function buildBoltPoints(seed, x, z, topY, bottomY, spread) {
  const pts = [];
  const segs = 16;
  let px = x;
  let pz = z;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = topY + (bottomY - topY) * t;
    if (i > 0 && i < segs) {
      px = x + boltRand(seed + i * 1.9) * spread * (1 - t * 0.72);
      pz = z + boltRand(seed + i * 2.4 + 40) * spread * (1 - t * 0.72);
    }
    pts.push(new THREE.Vector3(px, y, pz));
  }
  return pts;
}

function buildBranchPoints(seed, mainPts, startIdx, spread) {
  const start = mainPts[startIdx];
  const dir = boltRand(seed) > 0 ? 1 : -1;
  const pts = [start.clone()];
  const segs = 6;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    pts.push(new THREE.Vector3(
      start.x + dir * spread * t * (0.55 + boltRand(seed + i) * 0.45),
      start.y - t * (2.4 + boltRand(seed + i + 3) * 1.2),
      start.z + boltRand(seed + i + 7) * spread * 0.35 * t
    ));
  }
  return pts;
}

function spawnBoltLines(parent, count, colors, baseOrder) {
  const lines = [];
  for (let i = 0; i < count; i++) {
    const line = createBoltLine(colors[i % colors.length], baseOrder - (i % 4));
    parent.add(line);
    lines.push(line);
  }
  return lines;
}

function createBoltLine(color, renderOrder = 11) {
  const geo = new THREE.BufferGeometry();
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.renderOrder = renderOrder;
  line.frustumCulled = false;
  return line;
}

function setBoltPoints(line, points) {
  line.geometry.setFromPoints(points);
}

/** Soft lumpy cloud shadow for lightning target areas (normal blend, not additive). */
function createCloudShadowTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 5; i++) {
    const cx = 40 + Math.random() * 48;
    const cy = 40 + Math.random() * 48;
    const r = 22 + Math.random() * 28;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, 'rgba(18,14,32,0.62)');
    grad.addColorStop(0.55, 'rgba(28,24,42,0.32)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(cx, cy, r * 1.1, r * 0.75, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeShadowMat(map) {
  return new THREE.MeshBasicMaterial({
    map,
    color: 0xc8c4d8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

/** Vertical fire streak texture for the Soaring Destruction energy column. */
function createFireStreakTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 128, 256);

  for (let i = 0; i < 80; i++) {
    const x = Math.random() * 128;
    const w = 0.8 + Math.random() * 3.2;
    const peak = 0.08 + Math.random() * 0.32;
    const grad = ctx.createLinearGradient(x, 0, x, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.12, `rgba(255,240,220,${peak})`);
    grad.addColorStop(0.45, `rgba(255,120,60,${peak * 0.85})`);
    grad.addColorStop(0.78, `rgba(220,40,30,${peak * 0.55})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, w, 256);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 1.8);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dragon head + wings silhouette for the hover backdrop glow. */
function createDragonSilhouetteTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 256, 192);

  const cx = 128;
  const cy = 108;

  // Spread wings
  ctx.fillStyle = 'rgba(220,38,38,0.55)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.bezierCurveTo(40, cy - 50, 8, cy + 20, 24, cy + 52);
  ctx.lineTo(cx - 18, cy + 12);
  ctx.closePath();
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(cx, cy - 8);
  ctx.bezierCurveTo(216, cy - 50, 248, cy + 20, 232, cy + 52);
  ctx.lineTo(cx + 18, cy + 12);
  ctx.closePath();
  ctx.fill();

  // Inner wing glow
  ctx.fillStyle = 'rgba(251,146,60,0.45)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4);
  ctx.bezierCurveTo(62, cy - 28, 38, cy + 10, 52, cy + 38);
  ctx.lineTo(cx - 12, cy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 4);
  ctx.bezierCurveTo(194, cy - 28, 218, cy + 10, 204, cy + 38);
  ctx.lineTo(cx + 12, cy + 10);
  ctx.closePath();
  ctx.fill();

  // Dragon head / neck
  ctx.fillStyle = 'rgba(239,68,68,0.7)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 58);
  ctx.bezierCurveTo(cx - 22, cy - 38, cx - 28, cy - 8, cx - 14, cy + 8);
  ctx.lineTo(cx + 14, cy + 8);
  ctx.bezierCurveTo(cx + 28, cy - 8, cx + 22, cy - 38, cx, cy - 58);
  ctx.closePath();
  ctx.fill();

  // Eye glint
  ctx.fillStyle = 'rgba(254,226,226,0.85)';
  ctx.beginPath();
  ctx.ellipse(cx - 8, cy - 28, 4, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 8, cy - 28, 4, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** L-Drago Spin Steal + Soaring Destruction scene VFX. */
export function createLdragoAbilityVfx(scene) {
  ensureQuarksRuntime(scene);
  const root = new THREE.Group();
  scene.add(root);
  const getMat = createMatCache();
  const fireOuterTex = createFireStreakTexture();
  const fireInnerTex = createFireStreakTexture();
  const dragonSilhouetteTex = createDragonSilhouetteTexture();

  // Quarks — violet dragon fire / shock (no flat floor rings).
  const windupGatherBurst = createBurstSystem(scene, {
    additive: true,
    startSpeed: [2, 7],
    startSize: [0.1, 0.4],
    gravity: 4,
    coneAngle: 1.4,
    colorA: new Vector4(0.72, 0.45, 1, 1),
    colorB: new Vector4(0.35, 0.12, 0.65, 0),
  });
  const flightTrail = createDarkVortexTrail(scene);
  const launchShock = createImpactShockwave(scene, { tint: 'purple' });
  const lightningBurst = createBurstSystem(scene, {
    additive: true,
    startSpeed: [6, 18],
    startSize: [0.1, 0.45],
    gravity: -3,
    colorA: new Vector4(0.95, 0.9, 1, 1),
    colorB: new Vector4(0.55, 0.35, 0.95, 0),
  });
  // Electrified dark-energy vortex shell around Soaring Destruction flight.
  const darkVortex = createTrailSystem(scene, {
    rate: 85,
    startSize: [0.3, 0.85],
    startLife: [0.3, 0.65],
    gravity: 1,
    colorA: new Vector4(0.35, 0.08, 0.55, 0.9),
    colorB: new Vector4(0.15, 0.02, 0.3, 0),
  });
  // Meteo Absorb Break — crimson rush trail + impact (grounded dragon charge).
  const absorbTrail = createSpeedTrail(scene, { rate: 130, tint: 'crimson' });
  const absorbVortex = createTrailSystem(scene, {
    rate: 90,
    startSize: [0.28, 0.8],
    startLife: [0.28, 0.6],
    gravity: 1,
    colorA: new Vector4(0.95, 0.2, 0.12, 0.95),
    colorB: new Vector4(0.35, 0.04, 0.05, 0),
  });
  const absorbImpact = createSparkBurst(scene, { tint: 'red' });
  const absorbShock = createImpactShockwave(scene, { tint: 'purple' });
  const absorbDevourBurst = createBurstSystem(scene, {
    additive: true,
    startSpeed: [4, 14],
    startSize: [0.12, 0.55],
    gravity: 2,
    coneAngle: 1.45,
    colorA: new Vector4(1, 0.45, 0.2, 1),
    colorB: new Vector4(0.7, 0.08, 0.05, 0),
  });

  const stealGroup = new THREE.Group();
  const absorbGroup = new THREE.Group();
  const flightGroup = new THREE.Group();
  const upperGroup = new THREE.Group();
  root.add(stealGroup);
  root.add(absorbGroup);
  root.add(flightGroup);
  root.add(upperGroup);

  // Dragon-rush streaks for Absorb Break (elongated crimson blades).
  const absorbStreaks = [];
  for (let i = 0; i < 11; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 2.35),
      makeMat(i % 2 === 0 ? 0xfef2f2 : 0xef4444, 0, { additive: true })
    );
    mesh.renderOrder = 8;
    absorbGroup.add(mesh);
    absorbStreaks.push({ mesh, offset: i / 11 });
  }
  // Side dragon-wing sheets during rush (silhouette, not Soaring Destruction props).
  const absorbWings = [];
  for (let i = 0; i < 4; i++) {
    const side = i < 2 ? -1 : 1;
    const tier = i % 2;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.55 + tier * 0.25, 1.7 + tier * 0.45),
      makeMat(tier === 0 ? 0xf87171 : 0xb91c1c, 0, { additive: true, doubleSide: true })
    );
    mesh.renderOrder = 7;
    absorbGroup.add(mesh);
    absorbWings.push({ mesh, side, tier, flap: i * 0.7 });
  }
  const absorbCore = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    makeMat(0xfef2f2, 0, { additive: true })
  );
  absorbCore.renderOrder = 9;
  absorbGroup.add(absorbCore);
  const absorbRing = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    makeMat(0xef4444, 0, { additive: true })
  );
  absorbRing.renderOrder = 6;
  absorbGroup.add(absorbRing);

  function setVisible(mesh, opacity) {
    const show = opacity > 0.02;
    mesh.visible = show;
    mesh.material.opacity = show ? opacity : 0;
  }

  function spawnPool(parent, count, kind, geos, additive) {
    const traits = buildTraits(count, kind);
    const pool = [];
    const colors = [CRIMSON, RED_DEEP, RED_DARK];
    for (let i = 0; i < count; i++) {
      const tr = traits[i];
      const color = kind === 'ember'
        ? ORANGE
        : kind === 'helix'
          ? HELIX_HEAT_COLORS[tr.heatBand]
          : colors[tr.colorPick % 3];
      const mat = getMat(color, additive || kind === 'ember' || kind === 'helix');
      const geo = geos ? geos[tr.sizeTier] : new THREE.PlaneGeometry(tr.size, tr.size * 0.85);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = kind === 'drain' ? 4 : 5;
      mesh.visible = false;
      parent.add(mesh);
      pool.push({ mesh, traits: tr, kind });
    }
    return pool;
  }

  const drainPool = spawnPool(stealGroup, DRAIN_COUNT, 'drain', DRAIN_GEOS, false);
  const emberPool = spawnPool(stealGroup, EMBER_COUNT, 'ember', EMBER_GEOS, true);
  const helixPool = spawnPool(flightGroup, HELIX_FLAME_COUNT, 'helix', HELIX_GEOS, true);
  const stealBeams = [];
  const beamMat = getMat(PALE, true);
  for (let i = 0; i < STEAL_BEAM_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 0.05),
      beamMat
    );
    mesh.renderOrder = 6;
    stealGroup.add(mesh);
    stealBeams.push({ mesh, offset: i / STEAL_BEAM_COUNT });
  }

  const stealCore = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    getMat(WHITE_HOT, true)
  );
  stealCore.renderOrder = 7;
  stealGroup.add(stealCore);

  // Upper Mode — orbiting sparks + core glow (no floor range rings).
  const upperCore = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 1.25),
    getMat(PALE, true)
  );
  upperCore.renderOrder = 6;
  upperGroup.add(upperCore);

  const upperSparks = [];
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 0.28),
      getMat(i % 2 === 0 ? WHITE_HOT : PALE, true)
    );
    mesh.renderOrder = 6;
    upperGroup.add(mesh);
    upperSparks.push({ mesh, phase: (i / 10) * Math.PI * 2 });
  }

  const dragonWings = [];
  for (let i = 0; i < DRAGON_WING_COUNT; i++) {
    const side = i < 3 ? -1 : 1;
    const tier = i % 3;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42 + tier * 0.16, 1.55 + tier * 0.42),
      getMat(tier === 0 ? ORANGE : tier === 1 ? CRIMSON : RED_DEEP, true)
    );
    mesh.renderOrder = 6;
    flightGroup.add(mesh);
    dragonWings.push({
      mesh,
      side,
      tier,
      flapPhase: rand(i + 90) * Math.PI * 2,
    });
  }

  const orbitEmbers = [];
  for (let i = 0; i < ORBIT_EMBER_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 0.07),
      getMat(i % 2 === 0 ? PALE : ORANGE, true)
    );
    mesh.renderOrder = 7;
    flightGroup.add(mesh);
    orbitEmbers.push({ mesh, phase: (i / ORBIT_EMBER_COUNT) * Math.PI * 2, band: i % 3 });
  }

  const windupOutDust = [];
  for (let i = 0; i < WINDUP_OUT_DUST; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05 + (i % 4) * 0.015, 0.05 + (i % 3) * 0.012),
      getMat(i % 3 === 0 ? RED_DARK : RED_DEEP)
    );
    mesh.renderOrder = 3;
    flightGroup.add(mesh);
    windupOutDust.push({ mesh, phase: (i / WINDUP_OUT_DUST) * Math.PI * 2 });
  }

  const windupGather = [];
  for (let i = 0; i < WINDUP_IN_GATHER; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 0.04),
      getMat(i % 2 === 0 ? CRIMSON : ORANGE, true)
    );
    mesh.renderOrder = 4;
    flightGroup.add(mesh);
    windupGather.push({ mesh, phase: (i / WINDUP_IN_GATHER) * Math.PI * 2, band: rand(i + 40) });
  }

  // Volumetric windup crater — rising spark curtain (no flat RingGeometry).
  const windupCraterSparks = [];
  for (let i = 0; i < WINDUP_CRATER_SPARKS; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08 + (i % 3) * 0.04, 0.35 + (i % 4) * 0.12),
      getMat(i % 3 === 0 ? WHITE_HOT : i % 3 === 1 ? PALE : CRIMSON, true)
    );
    mesh.renderOrder = 3;
    flightGroup.add(mesh);
    windupCraterSparks.push({
      mesh,
      phase: (i / WINDUP_CRATER_SPARKS) * Math.PI * 2,
      band: i % 4,
    });
  }

  const windupPillar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.55, 1, 12, 1, true),
    getMat(ORANGE, true)
  );
  windupPillar.renderOrder = 3;
  flightGroup.add(windupPillar);

  const pillarOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.55, 0.85, 1, 14, 1, true),
    makeMat(RED_DARK, 0, { additive: true, map: fireOuterTex })
  );
  pillarOuter.renderOrder = 1;
  flightGroup.add(pillarOuter);

  const pillarInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.42, 1, 12, 1, true),
    makeMat(WHITE_HOT, 0, { additive: true, map: fireInnerTex })
  );
  pillarInner.renderOrder = 2;
  flightGroup.add(pillarInner);

  // Soft hover glow disc (billboard) — not a ground range ring.
  const hoverGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    getMat(CRIMSON, true)
  );
  hoverGlow.renderOrder = 5;
  flightGroup.add(hoverGlow);

  const dragonBackdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.2),
    makeMat(WHITE_HOT, 0, { additive: true, map: dragonSilhouetteTex })
  );
  dragonBackdrop.renderOrder = 4;
  flightGroup.add(dragonBackdrop);

  // Vertical shock sheets + dense sparks replace flat floor shock rings.
  const repulseSheets = [];
  for (let i = 0; i < REPULSE_SHEET_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35, 1.8),
      getMat(i % 2 === 0 ? WHITE_HOT : PALE, true)
    );
    mesh.renderOrder = 9;
    flightGroup.add(mesh);
    repulseSheets.push({
      mesh,
      angle: (i / REPULSE_SHEET_COUNT) * Math.PI * 2,
      delay: (i % 3) * 0.05,
    });
  }

  const repulseSparks = [];
  for (let i = 0; i < REPULSE_SPARK_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08 + (i % 3) * 0.03, 0.08 + (i % 2) * 0.025),
      getMat(i % 4 === 0 ? WHITE_HOT : PALE, true)
    );
    mesh.renderOrder = 8;
    flightGroup.add(mesh);
    repulseSparks.push({ mesh, angle: (i / REPULSE_SPARK_COUNT) * Math.PI * 2, band: i % 5 });
  }

  let lastLaunchPulse = false;

  let stealSpin = 0;
  let flightSpin = 0;
  let flightT = 0;
  let upperSpin = 0;
  let absorbSpin = 0;
  let didAbsorbLaunchBurst = false;
  let didAbsorbImpactBurst = false;
  let lastAbsorbImpact = false;

  function hideSteal() {
    for (const p of drainPool) { p.mesh.visible = false; p.mesh.material.opacity = 0; }
    for (const p of emberPool) { p.mesh.visible = false; p.mesh.material.opacity = 0; }
    for (const b of stealBeams) { b.mesh.visible = false; b.mesh.material.opacity = 0; }
    stealCore.visible = false;
    stealCore.material.opacity = 0;
  }

  function hideAbsorb() {
    for (const s of absorbStreaks) {
      s.mesh.visible = false;
      s.mesh.material.opacity = 0;
    }
    for (const w of absorbWings) {
      w.mesh.visible = false;
      w.mesh.material.opacity = 0;
    }
    absorbCore.visible = false;
    absorbCore.material.opacity = 0;
    absorbRing.visible = false;
    absorbRing.material.opacity = 0;
    absorbTrail.stop();
    absorbVortex.stop();
  }

  function hideUpper() {
    upperCore.material.opacity = 0;
    for (const s of upperSparks) s.mesh.material.opacity = 0;
  }

  function hideFlight() {
    for (const w of dragonWings) { w.mesh.visible = false; w.mesh.material.opacity = 0; }
    for (const p of helixPool) { p.mesh.visible = false; p.mesh.material.opacity = 0; }
    for (const e of orbitEmbers) { e.mesh.visible = false; e.mesh.material.opacity = 0; }
    for (const d of windupOutDust) { d.mesh.visible = false; d.mesh.material.opacity = 0; }
    for (const g of windupGather) { g.mesh.visible = false; g.mesh.material.opacity = 0; }
    for (const c of windupCraterSparks) { c.mesh.visible = false; c.mesh.material.opacity = 0; }
    windupPillar.visible = false;
    pillarOuter.visible = false;
    pillarInner.visible = false;
    hoverGlow.visible = false;
    dragonBackdrop.visible = false;
    windupPillar.material.opacity = 0;
    pillarOuter.material.opacity = 0;
    pillarInner.material.opacity = 0;
    hoverGlow.material.opacity = 0;
    dragonBackdrop.material.opacity = 0;
    for (const r of repulseSheets) { r.mesh.visible = false; r.mesh.material.opacity = 0; }
    for (const s of repulseSparks) { s.mesh.visible = false; s.mesh.material.opacity = 0; }
    flightTrail.stop();
    darkVortex.stop();
    lastLaunchPulse = false;
  }

  function billboard(mesh, camera) {
    mesh.quaternion.copy(camera.quaternion);
  }

  function reset() {
    root.visible = false;
    hideSteal();
    hideAbsorb();
    hideFlight();
    hideUpper();
    stealSpin = 0;
    flightSpin = 0;
    flightT = 0;
    upperSpin = 0;
    absorbSpin = 0;
    didAbsorbLaunchBurst = false;
    didAbsorbImpactBurst = false;
    lastAbsorbImpact = false;
  }

  reset();

  return {
    update(topGroup, body, camera, dt) {
      if (!topGroup || !body || !camera) {
        reset();
        return;
      }

      const spinStealing = !!body.userData.spinStealing;
      const upperMode = !!body.userData.ldragoUpperMode;
      const absorbPhase = body.userData.ldragoAbsorbPhase;
      const absorbWindup =
        !!body.userData.ldragoAbsorbWindup ||
        absorbPhase === 'windup' ||
        absorbPhase === 'coil';
      const absorbRush =
        !!body.userData.ldragoAbsorbRush ||
        absorbPhase === 'rush' ||
        absorbPhase === 'pierce' ||
        absorbPhase === 'impact';
      const inAbsorb = absorbWindup || absorbRush || absorbPhase != null;
      // Soaring Destruction cinematic VFX lives in ldragoSoaringVfx.js now.

      if (!spinStealing && !upperMode && !inAbsorb) {
        reset();
        return;
      }

      root.visible = true;

      const bx = body.position.x;
      const bz = body.position.z;
      const floorY = CONFIG.FLOOR_Y + 0.02;
      const R = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
      const yBase = body.position.y + (body.userData.visualYOffset ?? 0)
        + (body.userData.flightLift ?? 0);

      if (upperMode && !spinStealing && !inAbsorb) {
        hideSteal();
        hideAbsorb();
        hideFlight();
        upperSpin += dt * 3.2;
        const pulse = 0.7 + 0.3 * Math.sin(upperSpin * 2.4);
        upperGroup.position.set(bx, floorY, bz);

        upperCore.position.set(0, R * 0.4, 0);
        billboard(upperCore, camera);
        upperCore.scale.setScalar(topGroup.scale.x * (0.55 + pulse * 0.12));
        upperCore.material.opacity = 0.18 + pulse * 0.14;

        for (const s of upperSparks) {
          s.phase += dt * 4.5;
          const orbitR = R * (1.15 + 0.12 * Math.sin(s.phase * 2));
          const h = 0.2 + Math.abs(Math.sin(s.phase * 1.5)) * 0.55;
          s.mesh.position.set(
            Math.cos(s.phase + upperSpin) * orbitR,
            h,
            Math.sin(s.phase + upperSpin) * orbitR
          );
          billboard(s.mesh, camera);
          s.mesh.material.opacity = 0.22 + pulse * 0.16;
        }
        return;
      }

      hideUpper();

      // Absorb Break — dedicated crimson coil / rush / pierce (not Soaring Destruction).
      if (inAbsorb) {
        hideFlight();
        hideSteal();
        absorbSpin += dt * (absorbRush ? 11 : 6.5);
        absorbGroup.position.set(bx, floorY, bz);

        const phaseT = body.userData.ldragoAbsorbPhaseT ?? 0;
        const nx = body.userData.ldragoAbsorbNx ?? 0;
        const nz = body.userData.ldragoAbsorbNz ?? 0;
        const dirLen = Math.hypot(nx, nz) || 1;
        const dx = nx / dirLen;
        const dz = nz / dirLen;
        const yaw = Math.atan2(dx, dz);
        const impact = !!body.userData.ldragoAbsorbImpact || absorbPhase === 'impact';
        const devour = body.userData.ldragoAbsorbDevour ?? 0;

        if (absorbWindup && !absorbRush) {
          const coilT =
            absorbPhase === 'coil'
              ? clamp01(phaseT / LDRAGO_ABSORB_COIL_DUR)
              : 0.55;
          const gather = 0.55 + 0.45 * coilT;
          absorbCore.position.set(0, R * 0.48 + (body.userData.flightLift ?? 0) * 0.15, 0);
          billboard(absorbCore, camera);
          absorbCore.scale.setScalar(topGroup.scale.x * (0.65 + coilT * 0.55));
          setVisible(absorbCore, 0.22 + coilT * 0.45);

          absorbRing.position.set(0, R * 0.2, 0);
          billboard(absorbRing, camera);
          absorbRing.scale.setScalar(topGroup.scale.x * (1.4 - coilT * 0.55));
          setVisible(absorbRing, (0.12 + coilT * 0.28) * gather);

          // Orbiting crimson blades tighten inward as the coil gathers.
          for (let i = 0; i < absorbStreaks.length; i++) {
            const s = absorbStreaks[i];
            const ang = absorbSpin + s.offset * Math.PI * 2;
            const orbitR = R * (1.85 - coilT * 0.95);
            s.mesh.position.set(
              Math.cos(ang) * orbitR,
              R * (0.32 + 0.16 * Math.sin(ang * 2)) + (body.userData.flightLift ?? 0) * 0.2,
              Math.sin(ang) * orbitR
            );
            s.mesh.rotation.y = ang;
            billboard(s.mesh, camera);
            s.mesh.scale.set(1, 0.7 + coilT * 0.85, 1);
            setVisible(s.mesh, (0.28 + coilT * 0.4) * gather);
          }
          for (const w of absorbWings) {
            w.flap += dt * (5 + coilT * 4);
            const flap = 0.55 + 0.45 * Math.sin(w.flap);
            w.mesh.position.set(
              w.side * R * (1.15 + w.tier * 0.25) * (1.1 - coilT * 0.25),
              R * (0.45 + w.tier * 0.2) + (body.userData.flightLift ?? 0) * 0.25,
              -R * 0.15
            );
            w.mesh.rotation.set(0.2, yaw, w.side * (0.55 + flap * 0.35));
            setVisible(w.mesh, (0.18 + coilT * 0.35) * gather);
          }
          absorbTrail.stop();
          absorbVortex.follow(bx, yBase + 0.15, bz, gather > 0.6);
          didAbsorbLaunchBurst = false;
          didAbsorbImpactBurst = false;
        } else if (absorbRush || absorbPhase === 'impact') {
          if (!didAbsorbLaunchBurst) {
            absorbImpact.setPosition(bx, floorY + R * 0.25, bz);
            absorbImpact.burst(38);
            absorbShock.setPosition(bx, floorY + 0.08, bz);
            absorbShock.burst(28);
            didAbsorbLaunchBurst = true;
          }

          if (impact && !lastAbsorbImpact) {
            absorbImpact.setPosition(bx, floorY + R * 0.35, bz);
            absorbImpact.burst(52);
            absorbShock.setPosition(bx, floorY + 0.12, bz);
            absorbShock.burst(34);
            absorbDevourBurst.setPosition(bx, yBase, bz);
            absorbDevourBurst.burst(44);
            didAbsorbImpactBurst = true;
          }
          lastAbsorbImpact = impact;

          const pierceT =
            absorbPhase === 'pierce'
              ? clamp01(phaseT / LDRAGO_ABSORB_PIERCE_DUR)
              : absorbPhase === 'impact'
                ? clamp01(phaseT / LDRAGO_ABSORB_IMPACT_HOLD) * 0.2
                : 0;
          const speedFactor = clamp01((body.userData.ldragoAbsorbSpeed ?? 12) / 21);
          const intensity =
            absorbPhase === 'pierce'
              ? 0.95 * (1 - pierceT * 0.45)
              : absorbPhase === 'impact'
                ? 1.15
                : 0.7 + speedFactor * 0.55;

          absorbTrail.follow(bx, yBase, bz, intensity > 0.15);
          absorbVortex.follow(bx, yBase * 0.7 + 0.1, bz, intensity > 0.25);
          absorbCore.position.set(0, R * 0.42, 0);
          billboard(absorbCore, camera);
          absorbCore.scale.setScalar(topGroup.scale.x * (0.55 + intensity * 0.55 + devour * 0.35));
          setVisible(absorbCore, 0.22 + intensity * 0.4 + (impact ? 0.35 : 0) + devour * 0.3);

          absorbRing.position.set(0, R * 0.18, 0);
          billboard(absorbRing, camera);
          absorbRing.scale.setScalar(topGroup.scale.x * (0.9 + intensity * 0.7 + devour * 0.8));
          setVisible(absorbRing, (0.1 + intensity * 0.22 + devour * 0.35) * (impact ? 1.2 : 1));

          const streakLen = 1.0 + intensity * 2.0;
          for (let i = 0; i < absorbStreaks.length; i++) {
            const s = absorbStreaks[i];
            const lag = s.offset * R * (1.5 + intensity);
            const side = (i - (absorbStreaks.length - 1) * 0.5) * 0.1;
            s.mesh.position.set(-dx * lag + dz * side, R * 0.4, -dz * lag - dx * side);
            s.mesh.rotation.y = yaw;
            billboard(s.mesh, camera);
            s.mesh.scale.set(1, streakLen * (1 - s.offset * 0.22), 1);
            setVisible(
              s.mesh,
              Math.max(0.06, (0.48 - s.offset * 0.3) * intensity)
            );
          }

          for (const w of absorbWings) {
            w.flap += dt * 10;
            const flap = 0.6 + 0.4 * Math.sin(w.flap);
            w.mesh.position.set(
              w.side * R * (1.35 + w.tier * 0.35) * (0.9 + intensity * 0.25),
              R * (0.5 + w.tier * 0.22),
              -dx * R * 0.35
            );
            w.mesh.rotation.set(0.15, yaw, w.side * (0.7 + flap * 0.45));
            setVisible(w.mesh, (0.28 + intensity * 0.4) * (1 - pierceT * 0.5));
          }
        }

        // Keep steal beams for impact devour read.
        const burst = body.userData.spinStealBurstT ?? (impact || devour > 0.05 ? 1 : 0);
        if (burst > 0.05) {
          const fromX = body.userData.spinStealFromX ?? bx;
          const fromZ = body.userData.spinStealFromZ ?? bz;
          for (let i = 0; i < stealBeams.length; i++) {
            const beam = stealBeams[i];
            const t = (beam.offset + performance.now() * 0.0025) % 1;
            const ease = t * t * (3 - 2 * t);
            beam.mesh.position.set(
              fromX + (bx - fromX) * ease,
              yBase + 0.3 + Math.sin(t * Math.PI) * 0.45,
              fromZ + (bz - fromZ) * ease
            );
            billboard(beam.mesh, camera);
            setVisible(beam.mesh, burst * (1 - t) * 0.9);
          }
        } else {
          for (const b of stealBeams) {
            b.mesh.visible = false;
            b.mesh.material.opacity = 0;
          }
        }
        return;
      }

      hideAbsorb();
      didAbsorbLaunchBurst = false;
      didAbsorbImpactBurst = false;
      lastAbsorbImpact = false;

      if (spinStealing) {
        hideFlight();
        stealGroup.position.set(0, 0, 0);
        stealSpin -= dt * 4.2;

        const stealT = body.userData.spinStealT ?? 0;
        const life = clamp01(1 - stealT / LDRAGO_SPIN_STEAL_DURATION);
        const burst = body.userData.spinStealBurstT ?? 0;
        const fromX = body.userData.spinStealFromX ?? bx;
        const fromZ = body.userData.spinStealFromZ ?? bz;

        // Inward spiral drain particles (counter-clockwise).
        for (const p of drainPool) {
          const tr = p.traits;
          tr.phase -= dt * tr.speed * 2.8;
          const orbitR = R * tr.radius * (1.6 + 0.25 * Math.sin(tr.phase * 2));
          const h = 0.15 + tr.height * R * 0.5 + Math.sin(tr.phase) * 0.12;
          p.mesh.position.set(
            bx + Math.cos(tr.phase) * orbitR,
            yBase + h,
            bz + Math.sin(tr.phase) * orbitR
          );
          billboard(p.mesh, camera);
          setVisible(p.mesh, (0.28 + 0.2 * Math.sin(tr.phase * 3)) * life);
        }

        // Counter-rotating embers.
        for (const p of emberPool) {
          const tr = p.traits;
          tr.phase -= dt * (3.5 + tr.speed);
          const orbitR = R * (1.05 + 0.15 * Math.sin(tr.phase));
          p.mesh.position.set(
            bx + Math.cos(tr.phase) * orbitR,
            yBase + 0.2 + Math.sin(tr.phase * 2) * 0.15,
            bz + Math.sin(tr.phase) * orbitR
          );
          billboard(p.mesh, camera);
          setVisible(p.mesh, (0.35 + 0.15 * Math.sin(tr.phase)) * life);
        }

        // Steal burst beams from opponent toward L-Drago.
        if (burst > 0.05) {
          for (let i = 0; i < stealBeams.length; i++) {
            const beam = stealBeams[i];
            const t = (beam.offset + performance.now() * 0.002) % 1;
            const ease = t * t * (3 - 2 * t);
            beam.mesh.position.set(
              fromX + (bx - fromX) * ease,
              yBase + 0.25 + Math.sin(t * Math.PI) * 0.35,
              fromZ + (bz - fromZ) * ease
            );
            billboard(beam.mesh, camera);
            setVisible(beam.mesh, burst * (1 - t) * 0.7 * life);
          }
        } else {
          for (const b of stealBeams) { b.mesh.visible = false; b.mesh.material.opacity = 0; }
        }

        stealCore.position.set(bx, yBase, bz);
        billboard(stealCore, camera);
        stealCore.scale.setScalar(topGroup.scale.x * (0.4 + 0.15 * Math.sin(stealSpin * 3)));
        stealCore.visible = true;
        setVisible(stealCore, (0.15 + burst * 0.35) * life);
      }

    },
    reset,
  };
}
