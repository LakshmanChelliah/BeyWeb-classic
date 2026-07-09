import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';
import { LEONE_WALL_DURATION, LEONE_WALL_REACH_MULT } from '../game/abilities.js';

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

// Gale Force Wall — dusty green wind (not neon / light-show).
const GALE_PALE = 0xb8c99a;
const GALE_LIME = 0x7a9a45;
const GALE_MID = 0x556b2f;
const GALE_DEEP = 0x3a4a22;
const GALE_HAZE = 0x9aab78;
const DUST_TAN = 0xb5aea4;
const DUST_DARK = 0x7a7268;
const DEBRIS_TAN = 0x9a8b78;
const DEBRIS_DARK = 0x5c5348;

// Narrower vertical funnel — same height, tighter radii than the prior wide cone.
const TORNADO_HEIGHT = 7.2;
const TORNADO_BASE_R = 0.78;
const TORNADO_TOP_R = 2.05;
const WALL_ACTIVE_DUR = LEONE_WALL_DURATION;

const FUNNEL_SEGMENTS = 48;
const FUNNEL_HEIGHT_SEGS = 28;
const RIBBON_COUNT = 8;
const DEBRIS_COUNT = 42;
const DUST_COUNT = 64;
const STREAK_COUNT = 40;

/**
 * Dense swirling wind sheet — dusty green bands, not bright neon wash.
 */
function createGaleWindTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 512);

  // Soft dusty body — muted, translucent wind volume.
  const body = ctx.createLinearGradient(0, 0, 0, 512);
  body.addColorStop(0, 'rgba(184,201,154,0)');
  body.addColorStop(0.1, 'rgba(154,171,120,0.22)');
  body.addColorStop(0.4, 'rgba(85,107,47,0.48)');
  body.addColorStop(0.75, 'rgba(58,74,34,0.58)');
  body.addColorStop(0.94, 'rgba(58,74,34,0.28)');
  body.addColorStop(1, 'rgba(58,74,34,0)');
  ctx.fillStyle = body;
  ctx.fillRect(0, 0, 256, 512);

  // Dense helical wind streaks (diagonal bands).
  for (let i = 0; i < 42; i++) {
    const x0 = (i / 42) * 256 + rand(i + 1) * 14;
    const w = 2 + rand(i + 2) * 8;
    const peak = 0.22 + rand(i + 3) * 0.4;
    ctx.save();
    ctx.translate(x0, 0);
    ctx.transform(1, 0, 0.65 + rand(i + 4) * 0.4, 1, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, 'rgba(184,201,154,0)');
    g.addColorStop(0.15, `rgba(154,171,120,${peak * 0.45})`);
    g.addColorStop(0.5, `rgba(85,107,47,${peak})`);
    g.addColorStop(0.85, `rgba(58,74,34,${peak * 0.65})`);
    g.addColorStop(1, 'rgba(58,74,34,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, 512);
    ctx.restore();
  }

  // Fine grit filaments — wind texture, not light beams.
  for (let i = 0; i < 55; i++) {
    const x = rand(i + 50) * 256;
    const w = 0.5 + rand(i + 51) * 1.6;
    const peak = 0.1 + rand(i + 52) * 0.2;
    const g = ctx.createLinearGradient(x, 0, x, 512);
    g.addColorStop(0, 'rgba(181,174,164,0)');
    g.addColorStop(0.25, `rgba(154,171,120,${peak})`);
    g.addColorStop(0.6, `rgba(122,154,69,${peak * 0.55})`);
    g.addColorStop(1, 'rgba(92,83,72,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, w, 512);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3.6, 1.25);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Soft dusty mist / debris cloud for the tornado crown. */
function createGaleMistTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, 'rgba(181,174,164,0.55)');
  g.addColorStop(0.3, 'rgba(154,171,120,0.32)');
  g.addColorStop(0.65, 'rgba(85,107,47,0.14)');
  g.addColorStop(1, 'rgba(58,74,34,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Classic 3D funnel: pinched base, modest crown flare, mid waist.
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
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const t = clamp01((v.y + height * 0.5) / height);
    const waist = 1 - Math.sin(t * Math.PI) * 0.16;
    const crown = 1 + Math.pow(t, 2.6) * 0.12;
    v.x *= waist * crown;
    v.z *= waist * crown;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  return geo;
}

/** Helical ribbon strip that wraps the funnel for solid 3D wind sheets. */
function buildRibbonGeometry(turns, height, baseR, topR, width, segs = 110) {
  const positions = [];
  const uvs = [];
  const indices = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const ang = t * turns * Math.PI * 2;
    const y = t * height;
    const r = baseR + (topR - baseR) * t;
    const waist = 1 - Math.sin(t * Math.PI) * 0.14;
    const rr = r * waist;
    const c = Math.cos(ang);
    const s = Math.sin(ang);
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
  new THREE.PlaneGeometry(0.045, 0.04),
  new THREE.PlaneGeometry(0.06, 0.052),
  new THREE.PlaneGeometry(0.08, 0.068),
];
const DEBRIS_GEOS = [
  new THREE.PlaneGeometry(0.05, 0.038),
  new THREE.PlaneGeometry(0.07, 0.055),
  new THREE.PlaneGeometry(0.095, 0.07),
];
const STREAK_GEOS = [
  new THREE.PlaneGeometry(0.018, 0.18),
  new THREE.PlaneGeometry(0.024, 0.26),
  new THREE.PlaneGeometry(0.03, 0.34),
];

/**
 * Per-bey Three.js VFX for Rock Leone's two abilities.
 * Gale Force Wall is a dusty green 3D wind tornado (anime Lion Gale Force Wall).
 */
export function createLeoneAbilityVfx(scene) {
  const root = new THREE.Group();
  scene.add(root);
  const getMat = createMatCache();
  const windTex = createGaleWindTexture();
  const mistTex = createGaleMistTexture();
  const windTexFast = createGaleWindTexture();
  windTexFast.repeat.set(4.5, 1.4);
  const windTexSlow = createGaleWindTexture();
  windTexSlow.repeat.set(2.6, 1.0);

  // --- Anchor (unchanged green dig-in) ----------------------------------------
  const anchorRing = new THREE.Mesh(
    new THREE.RingGeometry(0.8, 1.1, 24),
    getMat(ANCHOR_GREEN, true)
  );
  anchorRing.rotation.x = -Math.PI / 2;
  anchorRing.renderOrder = 3;
  root.add(anchorRing);

  const shockRing = new THREE.Mesh(
    new THREE.RingGeometry(0.9, 1.05, 24),
    getMat(ANCHOR_GREEN, true)
  );
  shockRing.rotation.x = -Math.PI / 2;
  shockRing.renderOrder = 2;
  root.add(shockRing);

  const wisps = [];
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.55),
      getMat(ANCHOR_GREEN, true)
    );
    m.renderOrder = 4;
    root.add(m);
    wisps.push({ mesh: m, phase: (i / 4) * Math.PI * 2, speed: 0.9 + i * 0.15 });
  }

  let anchorShockT = 0;

  // --- 3D Tornado funnel (Lion Gale Force Wall) --------------------------------
  const tornadoGroup = new THREE.Group();
  root.add(tornadoGroup);

  const funnelGroup = new THREE.Group();
  tornadoGroup.add(funnelGroup);

  // Outer shell — dusty green wind wall (normal blend = solid volume, not glow).
  const outerShell = new THREE.Mesh(
    buildFunnelGeometry(
      TORNADO_BASE_R * 1.08,
      TORNADO_TOP_R * 1.02,
      TORNADO_HEIGHT,
      FUNNEL_SEGMENTS,
      FUNNEL_HEIGHT_SEGS
    ),
    makeMat(GALE_DEEP, 0, { additive: false, doubleSide: true, map: windTexSlow })
  );
  outerShell.position.y = TORNADO_HEIGHT * 0.5;
  outerShell.renderOrder = 5;
  funnelGroup.add(outerShell);

  // Mid shell — denser swirling wind body.
  const midShell = new THREE.Mesh(
    buildFunnelGeometry(
      TORNADO_BASE_R * 0.88,
      TORNADO_TOP_R * 0.86,
      TORNADO_HEIGHT * 0.96,
      FUNNEL_SEGMENTS,
      FUNNEL_HEIGHT_SEGS
    ),
    makeMat(GALE_MID, 0, { additive: false, doubleSide: true, map: windTex })
  );
  midShell.position.y = TORNADO_HEIGHT * 0.48;
  midShell.renderOrder = 6;
  funnelGroup.add(midShell);

  // Inner eye wall — slight haze only (kept subtle).
  const innerShell = new THREE.Mesh(
    buildFunnelGeometry(
      TORNADO_BASE_R * 0.48,
      TORNADO_TOP_R * 0.48,
      TORNADO_HEIGHT * 0.88,
      36,
      FUNNEL_HEIGHT_SEGS
    ),
    makeMat(GALE_HAZE, 0, { additive: true, doubleSide: true, map: windTexFast })
  );
  innerShell.position.y = TORNADO_HEIGHT * 0.44;
  innerShell.renderOrder = 7;
  funnelGroup.add(innerShell);

  // Helical wind ribbons — primary "tornado" read.
  const ribbons = [];
  for (let i = 0; i < RIBBON_COUNT; i++) {
    const turns = 2.6 + (i % 3) * 0.4;
    const baseScale = 0.72 + i * 0.045;
    const topScale = 0.76 + i * 0.05;
    const width = 0.1 + (i % 3) * 0.045;
    const mesh = new THREE.Mesh(
      buildRibbonGeometry(
        turns,
        TORNADO_HEIGHT * (0.9 + (i % 2) * 0.06),
        TORNADO_BASE_R * baseScale,
        TORNADO_TOP_R * topScale,
        width
      ),
      makeMat(i % 2 === 0 ? GALE_HAZE : GALE_LIME, 0, {
        additive: false,
        doubleSide: true,
        map: windTex,
      })
    );
    mesh.renderOrder = 8;
    funnelGroup.add(mesh);
    ribbons.push({
      mesh,
      spin: (i % 2 === 0 ? 1 : -1) * (2.0 + i * 0.32),
      phase: (i / RIBBON_COUNT) * Math.PI * 2,
    });
  }

  // Ground debris / suction ring — sized relative to funnel base.
  const groundRing = new THREE.Mesh(
    new THREE.RingGeometry(TORNADO_BASE_R * 0.3, TORNADO_BASE_R * 1.25, 40),
    getMat(DUST_DARK)
  );
  groundRing.rotation.x = -Math.PI / 2;
  groundRing.position.y = 0.04;
  groundRing.renderOrder = 4;
  tornadoGroup.add(groundRing);

  const groundOuter = new THREE.Mesh(
    new THREE.RingGeometry(TORNADO_BASE_R * 0.95, TORNADO_BASE_R * 2.0, 40),
    getMat(DUST_TAN)
  );
  groundOuter.rotation.x = -Math.PI / 2;
  groundOuter.position.y = 0.03;
  groundOuter.renderOrder = 3;
  tornadoGroup.add(groundOuter);

  // Crown debris cloud — dusty, not glowing.
  const crownMist = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    makeMat(DUST_TAN, 0, { additive: false, map: mistTex })
  );
  crownMist.rotation.x = -Math.PI / 2;
  crownMist.position.y = TORNADO_HEIGHT * 0.96;
  crownMist.renderOrder = 9;
  funnelGroup.add(crownMist);

  const crownMistOuter = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    makeMat(GALE_HAZE, 0, { additive: false, map: mistTex })
  );
  crownMistOuter.rotation.x = -Math.PI / 2;
  crownMistOuter.position.y = TORNADO_HEIGHT * 0.9;
  crownMistOuter.renderOrder = 8;
  funnelGroup.add(crownMistOuter);

  function spawnOrbitPool(count, kind) {
    const pool = [];
    const geos = kind === 'debris' ? DEBRIS_GEOS : kind === 'streak' ? STREAK_GEOS : DUST_GEOS;
    const colors = kind === 'debris'
      ? [DEBRIS_TAN, DUST_DARK, DEBRIS_DARK, GALE_DEEP]
      : kind === 'streak'
        ? [GALE_HAZE, GALE_LIME, DUST_TAN, GALE_MID]
        : [DUST_TAN, DUST_DARK, GALE_MID, DEBRIS_TAN, GALE_DEEP];
    for (let i = 0; i < count; i++) {
      const s = i + kind.charCodeAt(0) * 13;
      const mat = getMat(
        colors[Math.floor(rand(s + 9) * colors.length)],
        kind === 'streak'
      ).clone();
      const mesh = new THREE.Mesh(geos[Math.floor(rand(s + 6) * geos.length)], mat);
      mesh.renderOrder = kind === 'streak' ? 10 : 5;
      mesh.visible = false;
      tornadoGroup.add(mesh);
      pool.push({
        mesh,
        kind,
        heightBias: rand(s + 1),
        orbitPhase: rand(s + 2) * Math.PI * 2,
        orbitSpeed: 0.9 + rand(s + 3) * 1.7,
        radiusJitter: 0.75 + rand(s + 4) * 0.42,
        riseSpeed: 0.45 + rand(s + 5) * 1.0,
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
    for (const shell of [outerShell, midShell, innerShell, crownMist, crownMistOuter, groundRing, groundOuter]) {
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
    funnelGroup.scale.setScalar(0.01);
  }

  function setParticleVisible(mesh, opacity) {
    const show = opacity > 0.02;
    mesh.visible = show;
    mesh.material.opacity = show ? opacity : 0;
  }

  function billboard(mesh, camera) {
    mesh.quaternion.copy(camera.quaternion);
  }

  function tornadoRadiusAt(t, R, reachScale) {
    const base = R * TORNADO_BASE_R * reachScale;
    const top = R * TORNADO_TOP_R * reachScale;
    const pinch = 1 - Math.sin(t * Math.PI) * 0.14;
    return (base + (top - base) * t) * pinch;
  }

  function placeHelicalParticle(p, spin, R, reachScale, env, camera) {
    const { mesh, kind } = p;
    const cycle = (p.orbitPhase + spin * p.orbitSpeed * 0.15) % 1;
    const hNorm = (p.heightBias * 0.35 + cycle * p.riseSpeed) % 1;
    const h = hNorm * TORNADO_HEIGHT;
    const t = clamp01(h / TORNADO_HEIGHT);
    const r = tornadoRadiusAt(t, R, reachScale) * p.radiusJitter;

    const helix = spin * (1.6 + t * 2.2) + p.orbitPhase + t * Math.PI * 5;
    const turb = Math.sin(spin * 3.1 + p.layer * 9) * r * 0.13
      + Math.cos(spin * 2.3 + p.tumble) * r * 0.09;
    mesh.position.set(Math.cos(helix) * (r + turb), h, Math.sin(helix) * (r + turb));

    if (kind === 'streak') {
      mesh.rotation.set(0.25, helix + Math.PI / 2, 0.4);
    } else {
      billboard(mesh, camera);
      mesh.rotation.z = p.tumble + spin * p.tumbleRate * 0.14;
    }

    const baseFade = kind === 'debris'
      ? 0.48 * (1 - t * 0.65)
      : kind === 'streak'
        ? 0.2 + 0.32 * (1 - Math.abs(t - 0.42))
        : 0.22 + 0.38 * (1 - Math.abs(t - 0.28));
    const flicker = 0.8 + 0.2 * Math.sin(spin * 4.2 + p.orbitPhase);
    setParticleVisible(mesh, baseFade * flicker * env);
  }

  function setFunnelVisible(env, grow) {
    const g = Math.max(0.01, grow);
    funnelGroup.scale.set(g, g, g);

    const show = env > 0.02;
    outerShell.visible = show;
    midShell.visible = show;
    innerShell.visible = show;
    crownMist.visible = show;
    crownMistOuter.visible = show;
    groundRing.visible = show;
    groundOuter.visible = show;

    // Solid wind volume — higher normal-blend opacity, soft inner haze only.
    outerShell.material.opacity = 0.62 * env;
    midShell.material.opacity = 0.55 * env;
    innerShell.material.opacity = 0.14 * env;
    crownMist.material.opacity = 0.42 * env;
    crownMistOuter.material.opacity = 0.28 * env;
    groundRing.material.opacity = 0.14 * env;
    groundOuter.material.opacity = 0.08 * env;

    for (let i = 0; i < ribbons.length; i++) {
      const r = ribbons[i];
      r.mesh.visible = show;
      r.mesh.material.opacity = (0.38 + (i % 3) * 0.1) * env;
    }

    const crownR = TORNADO_TOP_R * 1.7 * g;
    crownMist.scale.setScalar(crownR);
    crownMistOuter.scale.setScalar(crownR * 1.3);
  }

  function reset() {
    root.visible = false;
    anchorRing.material.opacity = 0;
    shockRing.material.opacity = 0;
    for (const w of wisps) w.mesh.material.opacity = 0;
    hideTornado();
    anchorShockT = 0;
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
      const reachScale = reach / (R * LEONE_WALL_REACH_MULT);

      if (anchoring) {
        wallT = 0;
        wallOrbitAngle = 0;
        hideTornado();
        anchorShockT += dt;

        anchorRing.position.set(bx, floorY, bz);
        shockRing.position.set(bx, floorY, bz);

        if (anchorShockT < 0.35) {
          const t = anchorShockT / 0.35;
          const e = 1 - (1 - t) * (1 - t);
          anchorRing.scale.setScalar(R * (1 + e * 1.8));
          anchorRing.material.opacity = 0.55 * (1 - t);
          shockRing.scale.setScalar(R * (1 + e * 2.8));
          shockRing.material.opacity = 0.35 * (1 - t * t);
        } else {
          const pulse = 0.5 + 0.5 * Math.sin(anchorShockT * 6);
          anchorRing.scale.setScalar(R * 1.35);
          anchorRing.material.opacity = 0.18 + 0.12 * pulse;
          shockRing.material.opacity = 0;
        }

        for (const w of wisps) {
          w.phase += dt * w.speed * 1.4;
          const angle = w.phase;
          const orbitR = R * 1.1;
          const riseAmt = (w.phase * 0.18) % 1.6;
          w.mesh.position.set(
            bx + Math.cos(angle) * orbitR,
            floorY + riseAmt,
            bz + Math.sin(angle) * orbitR
          );
          billboard(w.mesh, camera);
          const fadeOut = 1 - riseAmt / 1.6;
          const fadeIn = clamp01(anchorShockT / 0.4);
          w.mesh.material.opacity = 0.28 * fadeIn * fadeOut;
        }
      }

      if (lionWall || lionWindup) {
        anchorShockT = 0;
        anchorRing.material.opacity = 0;
        shockRing.material.opacity = 0;
        for (const w of wisps) w.mesh.material.opacity = 0;

        wallT += dt;
        tornadoGroup.position.set(bx, floorY, bz);

        // Match prior particle tornado footprint: world radius = R * TORNADO_*_R * reachScale.
        const funnelXZ = R * reachScale;

        if (lionWindup) {
          const growT = clamp01(wallT / 0.45);
          const e = easeOut(growT);
          const preSpin = wallT * 3.4;

          setFunnelVisible(0.5 * e, e);
          funnelGroup.scale.set(funnelXZ * e, e, funnelXZ * e);
          funnelGroup.rotation.y = preSpin * 1.7;
          outerShell.rotation.y = -preSpin * 0.9;
          midShell.rotation.y = preSpin * 1.5;
          innerShell.rotation.y = -preSpin * 2.2;
          windTex.offset.x = (windTex.offset.x + dt * 1.6) % 1;
          windTexFast.offset.x = (windTexFast.offset.x - dt * 2.4) % 1;
          windTexSlow.offset.x = (windTexSlow.offset.x + dt * 0.8) % 1;

          for (const r of ribbons) {
            r.mesh.rotation.y = r.phase + preSpin * r.spin * 0.4;
          }

          groundRing.scale.setScalar(funnelXZ * (0.55 + e * 0.85));
          groundOuter.scale.setScalar(funnelXZ * (0.75 + e * 1.05));
          groundRing.rotation.z = -preSpin * 0.65;
          groundOuter.rotation.z = preSpin * 0.38;

          for (const p of allParticles) {
            if (p.kind === 'streak') {
              p.mesh.visible = false;
              p.mesh.material.opacity = 0;
              continue;
            }
            const ang = p.orbitPhase + preSpin;
            const r = R * (0.35 + e * 0.95) * p.radiusJitter;
            p.mesh.position.set(Math.cos(ang) * r, 0.06 + e * 0.65, Math.sin(ang) * r);
            billboard(p.mesh, camera);
            setParticleVisible(p.mesh, 0.32 * e * (p.kind === 'debris' ? 1 : 0.65));
          }
        } else {
          wallOrbitAngle += dt * 6.0;
          const fadeIn = clamp01(wallT / 0.22);
          const fadeOut = clamp01((WALL_ACTIVE_DUR - wallT) / 0.32);
          const env = fadeIn * fadeOut;
          const spin = wallOrbitAngle;

          setFunnelVisible(env, 1);
          funnelGroup.scale.set(funnelXZ, 1, funnelXZ);

          funnelGroup.rotation.y = spin * 0.6;
          outerShell.rotation.y = -spin * 1.05;
          midShell.rotation.y = spin * 1.7;
          innerShell.rotation.y = -spin * 2.5;

          windTex.offset.x = (windTex.offset.x + dt * 2.1) % 1;
          windTexFast.offset.x = (windTexFast.offset.x - dt * 3.0) % 1;
          windTexSlow.offset.x = (windTexSlow.offset.x + dt * 1.05) % 1;
          windTex.offset.y = (windTex.offset.y + dt * 0.15) % 1;

          for (const r of ribbons) {
            r.mesh.rotation.y = r.phase + spin * r.spin * 0.26;
          }

          const breath = 1 + Math.sin(spin * 0.75) * 0.025;
          outerShell.scale.set(breath, 1, breath);
          midShell.scale.set(1 / breath, 1, 1 / breath);

          groundRing.scale.setScalar(funnelXZ * (1.05 + Math.sin(spin * 1.2) * 0.05));
          groundOuter.scale.setScalar(funnelXZ * (1.4 + Math.sin(spin * 0.9) * 0.07));
          groundRing.rotation.z = -spin * 0.9;
          groundOuter.rotation.z = spin * 0.48;

          crownMist.rotation.z = spin * 0.45;
          crownMistOuter.rotation.z = -spin * 0.28;

          for (const p of allParticles) {
            placeHelicalParticle(p, spin, R, reachScale, env, camera);
          }
        }
      }
    },
    reset,
  };
}
