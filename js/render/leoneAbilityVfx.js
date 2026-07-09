import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';
import { LEONE_WALL_DURATION, LEONE_WALL_REACH_MULT } from '../game/abilities.js';
import {
  createBurstSystem,
  createTrailSystem,
  ensureQuarksRuntime,
  Vector4,
} from './vfx/quarksRuntime.js';
import { createWindDebris, createSparkBurst } from './vfx/presets.js';

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

/** Reuse materials by color/blend mode to cut draw-call batch breaks. */
function createMatCache() {
  const cache = new Map();
  return (color, additive = false, doubleSide = false) => {
    const key = `${color}|${additive ? 1 : 0}|${doubleSide ? 1 : 0}`;
    if (!cache.has(key)) cache.set(key, makeMat(color, 0, { additive, doubleSide }));
    return cache.get(key);
  };
}

function rand(seed) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

// Anchor — still a subtle green dig-in cue (power move only).
const ANCHOR_GREEN = 0x4ade80;

// Anime Gale Force Wall — pale / dark green cyclone (Metal Fusion / Fury).
const GALE_PALE = 0xd9f99d;
const GALE_LIME = 0xa3e635;
const GALE_MID = 0x65a30d;
const GALE_DEEP = 0x3f6212;
const GALE_CORE = 0xecfccb;
const GALE_WHITE = 0xf7fee7;
const DUST_TAN = 0xb5aea4;
const DUST_DARK = 0x7a7268;
const DEBRIS_TAN = 0x9a8b78;

// Keep the same relative size as the previous Gale Force Wall VFX.
const TORNADO_HEIGHT = 7.2;
const TORNADO_BASE_R = 1.1;
const TORNADO_TOP_R = 2.9;
const WALL_ACTIVE_DUR = LEONE_WALL_DURATION;

const FUNNEL_SEGMENTS = 48;
const FUNNEL_HEIGHT_SEGS = 28;
const RIBBON_COUNT = 6;
const DEBRIS_COUNT = 36;
const DUST_COUNT = 48;
const STREAK_COUNT = 28;
const LIGHTNING_VEIN_COUNT = 12;

/**
 * Swirling green wind sheet — vertical streaks + soft horizontal bands
 * so cylinder UVs read as a spinning cyclone wall (show-accurate).
 */
function createGaleWindTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 512);

  // Soft vertical body wash.
  const body = ctx.createLinearGradient(0, 0, 0, 512);
  body.addColorStop(0, 'rgba(236,252,203,0)');
  body.addColorStop(0.08, 'rgba(217,249,157,0.18)');
  body.addColorStop(0.35, 'rgba(163,230,53,0.42)');
  body.addColorStop(0.7, 'rgba(101,163,13,0.55)');
  body.addColorStop(0.92, 'rgba(63,98,18,0.35)');
  body.addColorStop(1, 'rgba(63,98,18,0)');
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, 256, 512);

  // Helical wind streaks (diagonal bands).
  for (let i = 0; i < 28; i++) {
    const x0 = (i / 28) * 256 + rand(i + 1) * 18;
    const w = 3 + rand(i + 2) * 10;
    const peak = 0.18 + rand(i + 3) * 0.45;
    ctx.save();
    ctx.translate(x0, 0);
    ctx.transform(1, 0, 0.55 + rand(i + 4) * 0.35, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, 'rgba(247,254,231,0)');
    g.addColorStop(0.12, `rgba(236,252,203,${peak * 0.55})`);
    g.addColorStop(0.45, `rgba(163,230,53,${peak})`);
    g.addColorStop(0.78, `rgba(101,163,13,${peak * 0.7})`);
    g.addColorStop(1, 'rgba(63,98,18,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 512);
    ctx.restore();
  }

  // Thin bright filaments for spinning detail.
  for (let i = 0; i < 40; i++) {
    const x = rand(i + 50) * 256;
    const w = 0.6 + rand(i + 51) * 1.8;
    const peak = 0.08 + rand(i + 52) * 0.22;
    const g = ctx.createLinearGradient(x, 0, x, 512);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.2, `rgba(247,254,231,${peak})`);
    g.addColorStop(0.55, `rgba(217,249,157,${peak * 0.65})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, 512);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.2, 1.15);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft mist / cloud cap for the tornado crown. */
function createGaleMistTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, 'rgba(247,254,231,0.85)');
  g.addColorStop(0.35, 'rgba(217,249,157,0.45)');
  g.addColorStop(0.7, 'rgba(163,230,53,0.18)');
  g.addColorStop(1, 'rgba(101,163,13,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Classic 3D funnel profile: pinched base, flared crown, slight mid waist
 * like a real mesocyclone / anime Gale Force Wall.
 */
function buildFunnelGeometry(baseR, topR, height, radialSegs, heightSegs) {
  const geo = new THREE.CylinderGeometry(
    topR,
    baseR,
    height,
    radialSegs,
    heightSegs,
    true
  );
  // Pinch the mid-column for a more tornado-like silhouette.
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = clamp01((v.y + height * 0.5) / height);
    const waist = 1 - Math.sin(t * Math.PI) * 0.12;
    // Extra flare near the top like a debris cloud.
    const crown = 1 + Math.pow(t, 2.4) * 0.18;
    v.x *= waist * crown;
    v.z *= waist * crown;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Helical ribbon strip that wraps the funnel for solid 3D wind sheets. */
function buildRibbonGeometry(turns, height, baseR, topR, width, segs = 96) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ang = t * turns * Math.PI * 2;
    const y = t * height;
    const r = baseR + (topR - baseR) * t;
    const waist = 1 - Math.sin(t * Math.PI) * 0.1;
    const rr = r * waist;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    // Inward / outward edge of the ribbon.
    const rIn = rr * (1 - width * 0.5);
    const rOut = rr * (1 + width * 0.5);
    positions.push(c * rIn, y, s * rIn);
    positions.push(c * rOut, y, s * rOut);
    uvs.push(0, t);
    uvs.push(1, t);
    if (i < segs) {
      const a = i * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

const DUST_GEOS = [
  new THREE.PlaneGeometry(0.04, 0.036),
  new THREE.PlaneGeometry(0.055, 0.048),
  new THREE.PlaneGeometry(0.07, 0.06),
];
const DEBRIS_GEOS = [
  new THREE.PlaneGeometry(0.045, 0.035),
  new THREE.PlaneGeometry(0.065, 0.05),
  new THREE.PlaneGeometry(0.085, 0.065),
];
const STREAK_GEOS = [
  new THREE.PlaneGeometry(0.025, 0.14),
  new THREE.PlaneGeometry(0.032, 0.2),
  new THREE.PlaneGeometry(0.04, 0.26),
];

/**
 * Per-bey Three.js VFX for Rock Leone's two abilities.
 * Gale Force Wall is a solid 3D green tornado funnel (anime Lion Gale Force Wall).
 */
export function createLeoneAbilityVfx(scene) {
  ensureQuarksRuntime(scene);
  const root = new THREE.Group();
  scene.add(root);
  const getMat = createMatCache();
  const windTex = createGaleWindTexture();
  const mistTex = createGaleMistTexture();
  const windTexFast = createGaleWindTexture();
  windTexFast.repeat.set(4.2, 1.35);
  const windTexSlow = createGaleWindTexture();
  windTexSlow.repeat.set(2.4, 0.95);

  // --- Anchor: rising dust wisps only (no floor range rings) -------------------
  const wisps = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.55),
      getMat(ANCHOR_GREEN, true)
    );
    m.renderOrder = 4;
    root.add(m);
    wisps.push({ mesh: m, phase: (i / 8) * Math.PI * 2, speed: 0.9 + i * 0.12 });
  }

  const anchorDust = createBurstSystem(scene, {
    additive: false,
    dustyColor: 0x6ee7b7,
    startSpeed: [1.5, 5],
    startSize: [0.15, 0.45],
    gravity: -6,
    colorA: new Vector4(0.3, 0.85, 0.5, 0.85),
    colorB: new Vector4(0.2, 0.45, 0.25, 0),
  });

  const galeDebris = createWindDebris(scene);
  const trueWallLightning = createSparkBurst(scene, { tint: 'green' });

  let anchorShockT = 0;
  let wasAnchoring = false;
  let lastLightningBurst = 0;

  // --- 3D Tornado funnel (Lion Gale Force Wall) --------------------------------
  const tornadoGroup = new THREE.Group();
  root.add(tornadoGroup);

  const funnelGroup = new THREE.Group();
  tornadoGroup.add(funnelGroup);

  // Outer shell — dark green wall of wind.
  const outerShell = new THREE.Mesh(
    buildFunnelGeometry(
      TORNADO_BASE_R * 1.15,
      TORNADO_TOP_R * 1.05,
      TORNADO_HEIGHT,
      FUNNEL_SEGMENTS,
      FUNNEL_HEIGHT_SEGS
    ),
    makeMat(GALE_DEEP, 0, { additive: true, doubleSide: true, map: windTexSlow })
  );
  outerShell.position.y = TORNADO_HEIGHT * 0.5;
  outerShell.renderOrder = 5;
  funnelGroup.add(outerShell);

  // Mid shell — brighter lime cyclone body.
  const midShell = new THREE.Mesh(
    buildFunnelGeometry(
      TORNADO_BASE_R * 0.92,
      TORNADO_TOP_R * 0.88,
      TORNADO_HEIGHT * 0.96,
      FUNNEL_SEGMENTS,
      FUNNEL_HEIGHT_SEGS
    ),
    makeMat(GALE_LIME, 0, { additive: true, doubleSide: true, map: windTex })
  );
  midShell.position.y = TORNADO_HEIGHT * 0.48;
  midShell.renderOrder = 6;
  funnelGroup.add(midShell);

  // Inner core — pale green eye wall.
  const innerShell = new THREE.Mesh(
    buildFunnelGeometry(
      TORNADO_BASE_R * 0.55,
      TORNADO_TOP_R * 0.55,
      TORNADO_HEIGHT * 0.9,
      36,
      FUNNEL_HEIGHT_SEGS
    ),
    makeMat(GALE_CORE, 0, { additive: true, doubleSide: true, map: windTexFast })
  );
  innerShell.position.y = TORNADO_HEIGHT * 0.45;
  innerShell.renderOrder = 7;
  funnelGroup.add(innerShell);

  // Bright axial core column (eye of the storm).
  const coreColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(
      TORNADO_TOP_R * 0.12,
      TORNADO_BASE_R * 0.22,
      TORNADO_HEIGHT * 0.85,
      20,
      1,
      true
    ),
    makeMat(GALE_WHITE, 0, { additive: true, doubleSide: true })
  );
  coreColumn.position.y = TORNADO_HEIGHT * 0.42;
  coreColumn.renderOrder = 8;
  funnelGroup.add(coreColumn);

  // Helical wind ribbons — solid 3D sheets wrapping the funnel.
  const ribbons = [];
  for (let i = 0; i < RIBBON_COUNT; i++) {
    const turns = 2.2 + (i % 3) * 0.35;
    const baseScale = 0.78 + i * 0.06;
    const topScale = 0.82 + i * 0.07;
    const width = 0.08 + (i % 3) * 0.04;
    const mesh = new THREE.Mesh(
      buildRibbonGeometry(
        turns,
        TORNADO_HEIGHT * (0.88 + (i % 2) * 0.08),
        TORNADO_BASE_R * baseScale,
        TORNADO_TOP_R * topScale,
        width
      ),
      makeMat(i % 2 === 0 ? GALE_PALE : GALE_LIME, 0, {
        additive: true,
        doubleSide: true,
        map: windTex,
      })
    );
    mesh.renderOrder = 9;
    funnelGroup.add(mesh);
    ribbons.push({
      mesh,
      spin: (i % 2 === 0 ? 1 : -1) * (1.8 + i * 0.35),
      phase: (i / RIBBON_COUNT) * Math.PI * 2,
    });
  }

  // No ground range rings — suction is sold by orbiting dust + funnel volume.

  // Crown mist disks — tornado cloud top.
  const crownMist = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    makeMat(GALE_PALE, 0, { additive: true, map: mistTex })
  );
  crownMist.rotation.x = -Math.PI / 2;
  crownMist.position.y = TORNADO_HEIGHT * 0.96;
  crownMist.renderOrder = 10;
  funnelGroup.add(crownMist);

  const crownMistOuter = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    makeMat(GALE_LIME, 0, { additive: true, map: mistTex })
  );
  crownMistOuter.rotation.x = -Math.PI / 2;
  crownMistOuter.position.y = TORNADO_HEIGHT * 0.9;
  crownMistOuter.renderOrder = 9;
  funnelGroup.add(crownMistOuter);

  // True Lion Gale Force Wall — green lightning veins laced through the funnel.
  const lightningVeins = [];
  for (let i = 0; i < LIGHTNING_VEIN_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 1.8 + (i % 3) * 0.4),
      makeMat(i % 2 === 0 ? GALE_CORE : GALE_PALE, 0, { additive: true })
    );
    mesh.visible = false;
    mesh.renderOrder = 12;
    funnelGroup.add(mesh);
    lightningVeins.push({
      mesh,
      phase: (i / LIGHTNING_VEIN_COUNT) * Math.PI * 2,
      heightBias: 0.15 + (i % 5) * 0.15,
      flicker: Math.random() * Math.PI * 2,
    });
  }

  // Orbiting debris / dust / wind streaks for volume and grit.
  function spawnOrbitPool(count, kind) {
    const pool = [];
    const geos = kind === 'debris' ? DEBRIS_GEOS : kind === 'streak' ? STREAK_GEOS : DUST_GEOS;
    const colors = kind === 'debris'
      ? [DEBRIS_TAN, DUST_DARK, GALE_DEEP]
      : kind === 'streak'
        ? [GALE_PALE, GALE_LIME, GALE_CORE]
        : [DUST_TAN, DUST_DARK, GALE_MID, DEBRIS_TAN];
    for (let i = 0; i < count; i++) {
      const s = i + kind.charCodeAt(0) * 13;
      const mat = getMat(colors[Math.floor(rand(s + 9) * colors.length)], kind !== 'debris').clone();
      const mesh = new THREE.Mesh(geos[Math.floor(rand(s + 6) * geos.length)], mat);
      mesh.renderOrder = kind === 'streak' ? 11 : 5;
      mesh.visible = false;
      tornadoGroup.add(mesh);
      pool.push({
        mesh,
        kind,
        heightBias: rand(s + 1),
        orbitPhase: rand(s + 2) * Math.PI * 2,
        orbitSpeed: 0.85 + rand(s + 3) * 1.6,
        radiusJitter: 0.78 + rand(s + 4) * 0.4,
        riseSpeed: 0.4 + rand(s + 5) * 0.95,
        tumble: rand(s + 7) * Math.PI * 2,
        tumbleRate: (rand(s + 8) - 0.5) * 5,
        layer: rand(s + 10),
      });
    }
    return pool;
  }

  const debrisPool = spawnOrbitPool(DEBRIS_COUNT, 'debris');
  const dustPool = spawnOrbitPool(DUST_COUNT, 'dust');
  const streakPool = spawnOrbitPool(STREAK_COUNT, 'streak');
  const allParticles = [...debrisPool, ...dustPool, ...streakPool];

  let wallOrbitAngle = 0;
  let wallT = 0;

  function hideTornado() {
    for (const shell of [outerShell, midShell, innerShell, coreColumn, crownMist, crownMistOuter]) {
      shell.material.opacity = 0;
      shell.visible = false;
    }
    for (const r of ribbons) {
      r.mesh.material.opacity = 0;
      r.mesh.visible = false;
    }
    for (const p of allParticles) {
      p.mesh.visible = false;
      p.mesh.material.opacity = 0;
    }
    for (const v of lightningVeins) {
      v.mesh.visible = false;
      v.mesh.material.opacity = 0;
    }
    funnelGroup.scale.setScalar(0.01);
    galeDebris.stop();
    lastLightningBurst = 0;
  }

  function setParticleVisible(mesh, opacity) {
    const show = opacity > 0.02;
    mesh.visible = show;
    mesh.material.opacity = show ? opacity : 0;
  }

  function billboard(mesh, camera) {
    mesh.quaternion.copy(camera.quaternion);
  }

  /** World-space radius along funnel height — fills physics reach at the base. */
  function tornadoRadiusAt(t, reach) {
    const base = reach * 0.92;
    const top = reach * (TORNADO_TOP_R / TORNADO_BASE_R) * 0.85;
    const pinch = 1 - Math.sin(t * Math.PI) * 0.08;
    return (base + (top - base) * t) * pinch;
  }

  function placeHelicalParticle(p, spin, reach, env, camera) {
    const { mesh, kind } = p;
    const cycle = (p.orbitPhase + spin * p.orbitSpeed * 0.15) % 1;
    const hNorm = (p.heightBias * 0.35 + cycle * p.riseSpeed) % 1;
    const h = hNorm * TORNADO_HEIGHT;
    const t = clamp01(h / TORNADO_HEIGHT);
    const r = tornadoRadiusAt(t, reach) * p.radiusJitter;

    const helix = spin * (1.5 + t * 2.0) + p.orbitPhase + t * Math.PI * 4.5;
    const turb = Math.sin(spin * 3.1 + p.layer * 9) * r * 0.12
      + Math.cos(spin * 2.3 + p.tumble) * r * 0.08;
    mesh.position.set(Math.cos(helix) * (r + turb), h, Math.sin(helix) * (r + turb));

    if (kind === 'streak') {
      mesh.rotation.set(0.2, helix + Math.PI / 2, 0.35);
    } else {
      billboard(mesh, camera);
      mesh.rotation.z = p.tumble + spin * p.tumbleRate * 0.14;
    }

    const baseFade = kind === 'debris'
      ? 0.4 * (1 - t * 0.7)
      : kind === 'streak'
        ? 0.16 + 0.28 * (1 - Math.abs(t - 0.4))
        : 0.18 + 0.32 * (1 - Math.abs(t - 0.3));
    const flicker = 0.78 + 0.22 * Math.sin(spin * 4.2 + p.orbitPhase);
    setParticleVisible(mesh, baseFade * flicker * env);
  }

  function setFunnelVisible(env, grow) {
    const g = Math.max(0.01, grow);
    const show = env > 0.02;
    outerShell.visible = show;
    midShell.visible = show;
    innerShell.visible = show;
    coreColumn.visible = show;
    crownMist.visible = show;
    crownMistOuter.visible = show;

    // Normal-blend dusty wind — avoid additive light-show.
    outerShell.material.opacity = 0.55 * env;
    midShell.material.opacity = 0.48 * env;
    innerShell.material.opacity = 0.32 * env;
    coreColumn.material.opacity = 0.14 * env;
    crownMist.material.opacity = 0.42 * env;
    crownMistOuter.material.opacity = 0.22 * env;

    for (let i = 0; i < ribbons.length; i++) {
      const r = ribbons[i];
      r.mesh.visible = show;
      r.mesh.material.opacity = (0.22 + (i % 3) * 0.06) * env;
    }

    const crownR = TORNADO_TOP_R * 1.85 * g;
    crownMist.scale.setScalar(crownR);
    crownMistOuter.scale.setScalar(crownR * 1.35);
  }

  function reset() {
    root.visible = false;
    for (const w of wisps) w.mesh.material.opacity = 0;
    hideTornado();
    anchorShockT = 0;
    wasAnchoring = false;
    wallOrbitAngle = 0;
    wallT = 0;
  }

  reset();

  return {
    update(topGroup, body, camera, dt) {
      if (!topGroup || !body || !camera) {
        reset();
        return;
      }

      const anchoring = !!body.userData.anchoring;
      const lionWall = !!body.userData.lionWall;
      const lionWindup = !!body.userData.lionWallWindup;

      if (!anchoring && !lionWall && !lionWindup) {
        reset();
        return;
      }

      root.visible = true;

      const bx = body.position.x;
      const bz = body.position.z;
      const floorY = CONFIG.FLOOR_Y + 0.02;
      const R = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
      const reach = body.userData.lionWallReach ?? R * LEONE_WALL_REACH_MULT;
      // Scale funnel so base radius ≈ physics reach (volume sells range, not a floor circle).
      const funnelXZ = reach / TORNADO_BASE_R;

      if (anchoring) {
        wallT = 0;
        wallOrbitAngle = 0;
        hideTornado();
        anchorShockT += dt;

        if (!wasAnchoring) {
          anchorDust.setPosition(bx, floorY + 0.1, bz);
          anchorDust.burst(22);
          wasAnchoring = true;
        }

        for (const w of wisps) {
          w.phase += dt * w.speed * 1.4;
          const angle = w.phase;
          const orbitR = R * (1.0 + 0.35 * Math.sin(w.phase * 0.5));
          const riseAmt = (w.phase * 0.18) % 1.6;
          w.mesh.position.set(
            bx + Math.cos(angle) * orbitR,
            floorY + riseAmt,
            bz + Math.sin(angle) * orbitR
          );
          billboard(w.mesh, camera);
          const fadeOut = 1 - riseAmt / 1.6;
          const fadeIn = clamp01(anchorShockT / 0.4);
          w.mesh.material.opacity = 0.32 * fadeIn * fadeOut;
        }
      } else {
        wasAnchoring = false;
      }

      if (lionWall || lionWindup) {
        anchorShockT = 0;
        for (const w of wisps) w.mesh.material.opacity = 0;

        wallT += dt;
        tornadoGroup.position.set(bx, floorY, bz);
        galeDebris.follow(bx, floorY + TORNADO_HEIGHT * 0.35, bz, true);

        if (lionWindup) {
          const growT = clamp01(wallT / 0.45);
          const e = easeOut(growT);
          const preSpin = wallT * 3.2;

          setFunnelVisible(0.55 * e, e);
          funnelGroup.scale.set(funnelXZ * e, e, funnelXZ * e);
          funnelGroup.rotation.y = preSpin * 1.6;
          outerShell.rotation.y = -preSpin * 0.8;
          midShell.rotation.y = preSpin * 1.4;
          innerShell.rotation.y = -preSpin * 2.1;
          coreColumn.rotation.y = preSpin * 2.8;
          windTex.offset.x = (windTex.offset.x + dt * 1.4) % 1;
          windTexFast.offset.x = (windTexFast.offset.x - dt * 2.2) % 1;
          windTexSlow.offset.x = (windTexSlow.offset.x + dt * 0.7) % 1;

          for (const r of ribbons) {
            r.mesh.rotation.y = r.phase + preSpin * r.spin * 0.35;
          }

          for (const p of allParticles) {
            if (p.kind === 'streak') {
              p.mesh.visible = false;
              p.mesh.material.opacity = 0;
              continue;
            }
            const ang = p.orbitPhase + preSpin;
            const r = reach * (0.25 + e * 0.7) * p.radiusJitter;
            p.mesh.position.set(Math.cos(ang) * r, 0.06 + e * 0.7, Math.sin(ang) * r);
            billboard(p.mesh, camera);
            setParticleVisible(p.mesh, 0.28 * e * (p.kind === 'debris' ? 1 : 0.6));
          }
          for (const v of lightningVeins) {
            v.mesh.visible = false;
            v.mesh.material.opacity = 0;
          }
        } else {
          wallOrbitAngle += dt * 5.8;
          const fadeIn = clamp01(wallT / 0.22);
          const fadeOut = clamp01((WALL_ACTIVE_DUR - wallT) / 0.32);
          const env = fadeIn * fadeOut;
          const spin = wallOrbitAngle;

          setFunnelVisible(env, 1);
          funnelGroup.scale.set(funnelXZ, 1, funnelXZ);

          funnelGroup.rotation.y = spin * 0.55;
          outerShell.rotation.y = -spin * 0.95;
          midShell.rotation.y = spin * 1.55;
          innerShell.rotation.y = -spin * 2.4;
          coreColumn.rotation.y = spin * 3.1;

          windTex.offset.x = (windTex.offset.x + dt * 1.85) % 1;
          windTexFast.offset.x = (windTexFast.offset.x - dt * 2.8) % 1;
          windTexSlow.offset.x = (windTexSlow.offset.x + dt * 0.95) % 1;
          windTex.offset.y = (windTex.offset.y + dt * 0.12) % 1;

          for (const r of ribbons) {
            r.mesh.rotation.y = r.phase + spin * r.spin * 0.22;
          }

          const breath = 1 + Math.sin(spin * 0.7) * 0.03;
          outerShell.scale.set(breath, 1, breath);
          midShell.scale.set(1 / breath, 1, 1 / breath);

          crownMist.rotation.z = spin * 0.4;
          crownMistOuter.rotation.z = -spin * 0.25;

          for (const p of allParticles) {
            placeHelicalParticle(p, spin, reach, env, camera);
          }

          // True Wall green lightning veins laced through the funnel.
          for (let i = 0; i < lightningVeins.length; i++) {
            const v = lightningVeins[i];
            v.flicker += dt * (8 + (i % 4));
            const ang = v.phase + spin * 1.8;
            const t = v.heightBias;
            const r = tornadoRadiusAt(t, reach) * 0.92;
            const h = t * TORNADO_HEIGHT;
            v.mesh.position.set(Math.cos(ang) * r, h, Math.sin(ang) * r);
            v.mesh.rotation.set(0.15, ang + Math.PI / 2, Math.sin(v.flicker) * 0.2);
            const flash = 0.35 + 0.65 * Math.max(0, Math.sin(v.flicker * 1.7));
            setParticleVisible(v.mesh, 0.45 * env * flash);
          }

          lastLightningBurst += dt;
          if (lastLightningBurst > 0.45) {
            lastLightningBurst = 0;
            trueWallLightning.setPosition(bx, floorY + TORNADO_HEIGHT * 0.55, bz);
            trueWallLightning.burst(18);
          }
        }
      } else {
        galeDebris.stop();
      }
    },
    reset,
  };
}
