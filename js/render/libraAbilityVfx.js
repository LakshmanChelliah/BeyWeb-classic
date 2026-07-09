import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';
import {
  LIBRA_BUSTER_DURATION,
  LIBRA_BUSTER_RADIUS_MULT,
  LIBRA_BUSTER_SPREAD_DUR,
  LIBRA_BUSTER_WINDUP_DUR,
  LIBRA_SHIELD_DURATION,
  effectiveSpecialWindup,
  libraBusterSandRadius,
} from '../game/abilities.js';
import {
  createBurstSystem,
  createTrailSystem,
  ensureQuarksRuntime,
  Vector4,
} from './vfx/quarksRuntime.js';
import { createSandStorm, createImpactShockwave } from './vfx/presets.js';

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

/** Vertical rain-streak texture for the Sonic Buster energy column (show-accurate). */
function createPillarStreakTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, 128, 256);

  for (let i = 0; i < 90; i++) {
    const x = Math.random() * 128;
    const w = 0.8 + Math.random() * 2.8;
    const peak = 0.06 + Math.random() * 0.28;
    const grad = ctx.createLinearGradient(x, 0, x, 256);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.15, `rgba(255,255,252,${peak})`);
    grad.addColorStop(0.55, `rgba(230,255,200,${peak * 0.75})`);
    grad.addColorStop(0.9, `rgba(210,250,170,${peak * 0.3})`);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(x, 0, w, 256);
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(5, 1.5);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const SHIELD_GREEN = 0x4ade80;
const SHIELD_LIME = 0xa3e635;
const SHIELD_PALE = 0xd9f99d;

const BUSTER_LIME = 0xecfccb;
const BUSTER_NEON = 0xf7fee7;
const BUSTER_WHITE = 0xffffff;
const BUSTER_GLOW = 0xfefff5;

const SAND_LIGHT = 0xe8d4b8;
const SAND_MID = 0xc9a87a;
const SAND_DARK = 0xa88455;
const SAND_DUST = 0xd9bf98;
const SAND_DEEP = 0x8f6f45;

const PILLAR_HEIGHT = 22;
const PILLAR_OUTER_R = 1.55;
const PILLAR_MID_R = 0.95;
const PILLAR_CORE_R = 0.48;
const PILLAR_STREAK_COUNT = 36;

const PIT_PARTICLE_COUNT = 36;
const SHIELD_WISP_COUNT = 6;
const SAND_DUST_COUNT = 18;

function rand(seed) {
  const x = Math.sin(seed * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function easeOut(t) {
  return 1 - (1 - t) * (1 - t);
}

/** Flame Libra Sonic Shield + Sonic Buster scene VFX. */
export function createLibraAbilityVfx(scene) {
  ensureQuarksRuntime(scene);
  const root = new THREE.Group();
  scene.add(root);
  const getMat = createMatCache();
  const pillarStreakTex = createPillarStreakTexture();

  const shieldGroup = new THREE.Group();
  const pillarGroup = new THREE.Group();
  const pitGroup = new THREE.Group();
  root.add(shieldGroup);
  root.add(pillarGroup);
  root.add(pitGroup);

  // Volumetric sonic dome — hemisphere shell (no flat reach ring).
  const shieldDomeMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.52),
    makeMat(SHIELD_GREEN, 0, { additive: true, doubleSide: true })
  );
  shieldDomeMesh.rotation.x = Math.PI;
  shieldDomeMesh.position.y = 0.05;
  shieldDomeMesh.renderOrder = 4;
  shieldGroup.add(shieldDomeMesh);

  const shieldInner = new THREE.Mesh(
    new THREE.SphereGeometry(0.88, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5),
    makeMat(SHIELD_LIME, 0, { additive: true, doubleSide: true })
  );
  shieldInner.rotation.x = Math.PI;
  shieldInner.position.y = 0.05;
  shieldInner.renderOrder = 5;
  shieldGroup.add(shieldInner);

  const shieldWisps = [];
  for (let i = 0; i < SHIELD_WISP_COUNT + 6; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.42),
      getMat(i % 2 === 0 ? SHIELD_PALE : SHIELD_GREEN, true)
    );
    mesh.renderOrder = 6;
    shieldGroup.add(mesh);
    shieldWisps.push({ mesh, phase: (i / (SHIELD_WISP_COUNT + 6)) * Math.PI * 2, band: i % 3 });
  }

  const shieldRipple = createTrailSystem(scene, {
    rate: 28,
    startSize: [0.1, 0.35],
    startLife: [0.2, 0.45],
    colorA: new Vector4(0.4, 0.95, 0.55, 0.7),
    colorB: new Vector4(0.85, 1, 0.7, 0),
  });

  const sandStorm = createSandStorm(scene);
  const sandBurst = createBurstSystem(scene, {
    additive: false,
    dustyColor: 0xc4a35a,
    startSpeed: [2, 7],
    startSize: [0.15, 0.5],
    gravity: -8,
    colorA: new Vector4(0.9, 0.78, 0.45, 0.9),
    colorB: new Vector4(0.5, 0.38, 0.2, 0),
  });
  // Piercing shriek — radial sonic pulse bursts (particles, not flat rings).
  const shriekPulse = createImpactShockwave(scene, { tint: 'sand' });
  let lastShriekPulse = 0;

  // --- Sonic Buster energy column (anime-style vertical pillar) ----------------
  const pillarShell = new THREE.Mesh(
    new THREE.CylinderGeometry(PILLAR_OUTER_R, PILLAR_OUTER_R * 1.04, PILLAR_HEIGHT, 40, 1, true),
    makeMat(0xffffff, 0, { additive: true, doubleSide: true, map: pillarStreakTex })
  );
  pillarShell.position.y = PILLAR_HEIGHT * 0.5;
  pillarShell.renderOrder = 8;
  pillarGroup.add(pillarShell);

  const pillarMid = new THREE.Mesh(
    new THREE.CylinderGeometry(PILLAR_MID_R, PILLAR_MID_R * 0.98, PILLAR_HEIGHT * 0.98, 32, 1, true),
    getMat(BUSTER_NEON, true, true)
  );
  pillarMid.position.y = PILLAR_HEIGHT * 0.5;
  pillarMid.renderOrder = 9;
  pillarGroup.add(pillarMid);

  const pillarCore = new THREE.Mesh(
    new THREE.CylinderGeometry(PILLAR_CORE_R, PILLAR_CORE_R * 0.92, PILLAR_HEIGHT * 0.95, 24, 1, true),
    getMat(BUSTER_WHITE, true, true)
  );
  pillarCore.position.y = PILLAR_HEIGHT * 0.5;
  pillarCore.renderOrder = 10;
  pillarGroup.add(pillarCore);

  const pillarSandFill = new THREE.Mesh(
    new THREE.CircleGeometry(PILLAR_OUTER_R * 1.02, 36),
    getMat(SAND_MID)
  );
  pillarSandFill.rotation.x = -Math.PI / 2;
  pillarSandFill.position.y = 0.03;
  pillarSandFill.renderOrder = 7;
  pillarGroup.add(pillarSandFill);

  // Soft sand mound billboards at pillar base (no flat RingGeometry).
  const pillarBaseMotes = [];
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35 + (i % 3) * 0.12, 0.18 + (i % 2) * 0.08),
      getMat(i % 2 === 0 ? SAND_DARK : SAND_MID)
    );
    mesh.renderOrder = 11;
    pillarGroup.add(mesh);
    pillarBaseMotes.push({
      mesh,
      angle: (i / 10) * Math.PI * 2,
      radius: PILLAR_OUTER_R * (0.55 + (i % 4) * 0.12),
    });
  }

  const pillarStreaks = [];
  for (let i = 0; i < PILLAR_STREAK_COUNT; i++) {
    const s = i + 211;
    const angle = (i / PILLAR_STREAK_COUNT) * Math.PI * 2;
    const r = PILLAR_OUTER_R * (0.55 + rand(s) * 0.38);
    const h = 3.5 + rand(s + 1) * 14;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06 + rand(s + 2) * 0.1, h),
      getMat(rand(s + 3) > 0.45 ? BUSTER_GLOW : BUSTER_LIME, true)
    );
    mesh.rotation.y = angle;
    mesh.renderOrder = 12;
    pillarGroup.add(mesh);
    pillarStreaks.push({
      mesh,
      angle,
      radius: r,
      height: h,
      speed: 9 + rand(s + 4) * 14,
      phase: rand(s + 5) * PILLAR_HEIGHT,
    });
  }

  // Sand pit sold by particles + haze + soft disc — no flat range rings.
  const pitInner = new THREE.Mesh(
    new THREE.CircleGeometry(0.54, 32),
    getMat(SAND_MID)
  );
  pitInner.rotation.x = -Math.PI / 2;
  pitInner.renderOrder = 1;
  pitGroup.add(pitInner);

  const pitRimMotes = [];
  for (let i = 0; i < 16; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22 + (i % 3) * 0.1, 0.1 + (i % 2) * 0.06),
      getMat(i % 2 === 0 ? SAND_DARK : SAND_DEEP)
    );
    mesh.renderOrder = 4;
    pitGroup.add(mesh);
    pitRimMotes.push({
      mesh,
      phase: (i / 16) * Math.PI * 2,
      band: 0.85 + (i % 4) * 0.04,
    });
  }

  const pitParticles = [];
  const sandColors = [SAND_LIGHT, SAND_MID, SAND_DARK, SAND_DUST, SAND_DEEP];
  for (let i = 0; i < PIT_PARTICLE_COUNT; i++) {
    const s = i + 41;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.03 + rand(s) * 0.05, 0.028 + rand(s + 1) * 0.04),
      getMat(sandColors[Math.floor(rand(s + 2) * sandColors.length)])
    );
    mesh.renderOrder = 3;
    pitGroup.add(mesh);
    pitParticles.push({
      mesh,
      phase: rand(s + 3) * Math.PI * 2,
      radius: 0.2 + rand(s + 4) * 0.75,
      speed: 0.5 + rand(s + 5) * 1.1,
      rise: rand(s + 6) * 0.35,
    });
  }

  // Low sandstorm haze — readable field, not particle spam.
  const sandDust = [];
  for (let i = 0; i < SAND_DUST_COUNT; i++) {
    const s = i + 91;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.35 + rand(s) * 0.55, 0.12 + rand(s + 1) * 0.18),
      getMat(sandColors[Math.floor(rand(s + 2) * sandColors.length)])
    );
    mesh.renderOrder = 2;
    pitGroup.add(mesh);
    sandDust.push({
      mesh,
      phase: rand(s + 3) * Math.PI * 2,
      radius: 0.35 + rand(s + 4) * 0.65,
      speed: 0.35 + rand(s + 5) * 0.7,
      height: 0.08 + rand(s + 6) * 0.35,
    });
  }

  let shieldSpin = 0;
  let pitSpin = 0;
  let pitT = 0;
  let pillarScroll = 0;

  function hideShield() {
    shieldDomeMesh.material.opacity = 0;
    shieldInner.material.opacity = 0;
    for (const w of shieldWisps) w.mesh.material.opacity = 0;
    shieldRipple.stop();
  }

  function hidePillar() {
    pillarShell.material.opacity = 0;
    pillarMid.material.opacity = 0;
    pillarCore.material.opacity = 0;
    pillarSandFill.material.opacity = 0;
    for (const m of pillarBaseMotes) m.mesh.material.opacity = 0;
    for (const s of pillarStreaks) s.mesh.material.opacity = 0;
    pillarGroup.scale.set(1, 0.001, 1);
  }

  function hidePit() {
    pitInner.material.opacity = 0;
    for (const m of pitRimMotes) m.mesh.material.opacity = 0;
    for (const p of pitParticles) p.mesh.material.opacity = 0;
    for (const d of sandDust) d.mesh.material.opacity = 0;
  }

  function billboard(mesh, camera) {
    mesh.quaternion.copy(camera.quaternion);
  }

  function updateSandPit(body, camera, dt, reach, env) {
    const cx = body.position.x + (body.userData.flightOffsetX ?? 0);
    const cz = body.position.z + (body.userData.flightOffsetZ ?? 0);
    pitGroup.position.set(cx, CONFIG.FLOOR_Y + 0.02, cz);

    const pitR = body.userData.sonicBusterSpread ?? libraBusterSandRadius(reach, pitT);
    const spreadT = clamp01(pitT / LIBRA_BUSTER_SPREAD_DUR);
    const stillGrowing = spreadT < 0.98;

    pitInner.scale.set(pitR * 0.72, pitR * 0.72, 1);
    pitInner.material.opacity = 0.38 * env * Math.min(1, pitR / (reach * 0.15 + 0.01));

    // Growing rim sold by billboard motes + quarks (no flat RingGeometry).
    for (const m of pitRimMotes) {
      m.phase += dt * (1.2 + (stillGrowing ? 2.4 : 0.6));
      const pr = pitR * m.band;
      m.mesh.position.set(
        Math.cos(m.phase + pitSpin * 0.5) * pr,
        0.06 + Math.abs(Math.sin(m.phase * 2)) * 0.08,
        Math.sin(m.phase + pitSpin * 0.5) * pr
      );
      billboard(m.mesh, camera);
      m.mesh.material.opacity =
        (stillGrowing ? 0.42 : 0.28) * env * (0.55 + 0.45 * Math.sin(m.phase * 3));
    }
    if (stillGrowing && Math.floor(pitT * 8) !== Math.floor((pitT - dt) * 8)) {
      sandBurst.setPosition(cx, CONFIG.FLOOR_Y + 0.15, cz);
      sandBurst.burst(10 + Math.floor(spreadT * 14));
    }

    for (const p of pitParticles) {
      p.phase += dt * p.speed * (1 + pitSpin * 0.08);
      const band = 0.22 + p.radius * 0.78;
      const pr = pitR * band;
      const h = 0.03 + p.rise * (0.4 + 0.6 * band);
      p.mesh.position.set(
        Math.cos(p.phase + pitSpin) * pr,
        h,
        Math.sin(p.phase + pitSpin) * pr
      );
      billboard(p.mesh, camera);
      const atFront = band > 0.72 ? 1.05 : 0.8;
      const flicker = 0.55 + 0.45 * Math.sin(p.phase * 3 + pitSpin);
      p.mesh.material.opacity = 0.32 * flicker * env * atFront;
    }

    for (const d of sandDust) {
      d.phase += dt * d.speed;
      const pr = pitR * d.radius;
      d.mesh.position.set(
        Math.cos(d.phase + pitSpin * 0.4) * pr,
        d.height * (0.7 + 0.3 * Math.sin(d.phase * 2)),
        Math.sin(d.phase + pitSpin * 0.4) * pr
      );
      billboard(d.mesh, camera);
      d.mesh.material.opacity = 0.16 * env * (0.6 + 0.4 * Math.sin(d.phase));
    }
  }

  function updatePillar(body, camera, dt, env, growY) {
    const bx = body.position.x + (body.userData.flightOffsetX ?? 0);
    const bz = body.position.z + (body.userData.flightOffsetZ ?? 0);
    const floorY = CONFIG.FLOOR_Y + 0.02;

    pillarGroup.position.set(bx, floorY, bz);
    pillarGroup.scale.set(1, Math.max(0.04, growY), 1);

    pillarScroll += dt * 0.75;
    pillarStreakTex.offset.y = pillarScroll;

    // Vibration wobble on the pillar — sells the sonic shriek without chaos.
    const vib = Math.sin(pitT * 42) * 0.012 * env;
    pillarGroup.position.x += vib;
    pillarGroup.position.z += Math.sin(pitT * 37) * 0.01 * env;

    const pulse = 0.9 + 0.1 * Math.sin(pitT * 5);
    const shellOp = 0.16 * env * pulse;
    const midOp = 0.08 * env * pulse;
    const coreOp = 0.14 * env;
    const baseOp = 0.4 * env * (0.92 + 0.08 * Math.sin(pitT * 7));

    pillarShell.material.opacity = shellOp;
    pillarMid.material.opacity = midOp;
    pillarCore.material.opacity = coreOp;
    pillarSandFill.material.opacity = baseOp;

    for (const m of pillarBaseMotes) {
      m.mesh.position.set(
        Math.cos(m.angle + pitT * 1.5) * m.radius,
        0.08 + Math.abs(Math.sin(m.angle * 2 + pitT * 3)) * 0.06,
        Math.sin(m.angle + pitT * 1.5) * m.radius
      );
      billboard(m.mesh, camera);
      m.mesh.material.opacity = baseOp * 0.85;
    }

    for (const s of pillarStreaks) {
      s.phase = (s.phase + s.speed * dt) % PILLAR_HEIGHT;
      const y = s.phase;
      s.mesh.position.set(
        Math.cos(s.angle) * s.radius,
        y,
        Math.sin(s.angle) * s.radius
      );
      s.mesh.rotation.y = s.angle;
      const streakEnv = env * clamp01(1 - Math.abs(y - PILLAR_HEIGHT * 0.45) / (PILLAR_HEIGHT * 0.55));
      s.mesh.material.opacity = (0.1 + 0.08 * Math.sin(pitT * 4 + s.angle * 3)) * streakEnv;
    }
  }

  function reset() {
    root.visible = false;
    hideShield();
    hidePillar();
    hidePit();
    shieldSpin = 0;
    pitSpin = 0;
    pitT = 0;
    pillarScroll = 0;
    lastShriekPulse = 0;
  }

  reset();

  return {
    update(topGroup, body, camera, dt) {
      if (!topGroup || !body || !camera) {
        reset();
        return;
      }

      const sonicShield = !!body.userData.sonicShield;
      const busterWindup = !!body.userData.sonicBusterWindup;
      const sonicBuster = !!body.userData.sonicBuster;

      if (!sonicShield && !busterWindup && !sonicBuster) {
        reset();
        return;
      }

      root.visible = true;

      const bx = body.position.x;
      const bz = body.position.z;
      const floorY = CONFIG.FLOOR_Y + 0.02;
      const R = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;

      if (sonicShield) {
        hidePillar();
        hidePit();
        shieldGroup.position.set(bx, floorY, bz);
        shieldSpin += dt * 4.8;

        const t = body.userData.sonicShieldT ?? 0;
        const life = clamp01(1 - t / LIBRA_SHIELD_DURATION);
        const burst = body.userData.sonicShieldBurstT ?? 0;
        const pulse = 0.75 + 0.25 * Math.sin(shieldSpin * 2.0);
        const reach = body.userData.sonicShieldReach ?? R * 2.75;
        // Dome radius matches physics reach — volume sells the shield, not a flat ring.
        const domeR = reach * (0.92 + burst * 0.08 + pulse * 0.04);

        shieldDomeMesh.scale.set(domeR, domeR * 0.72, domeR);
        shieldDomeMesh.material.opacity = (0.22 + pulse * 0.14 + burst * 0.12) * life;
        shieldDomeMesh.rotation.y = shieldSpin * 0.35;

        shieldInner.scale.set(domeR * 0.82, domeR * 0.58, domeR * 0.82);
        shieldInner.material.opacity = (0.12 + pulse * 0.1) * life;
        shieldInner.rotation.y = -shieldSpin * 0.55;

        shieldRipple.follow(bx, floorY + domeR * 0.35, bz, true);

        for (const w of shieldWisps) {
          w.phase += dt * (1.8 + w.band * 0.35);
          const orbitR = domeR * (0.55 + w.band * 0.18);
          const h = 0.2 + w.band * 0.22 + Math.sin(w.phase * 2) * 0.1;
          w.mesh.position.set(
            Math.cos(w.phase + shieldSpin) * orbitR,
            h,
            Math.sin(w.phase + shieldSpin) * orbitR
          );
          billboard(w.mesh, camera);
          w.mesh.material.opacity = (0.3 + burst * 0.22) * life;
        }
      } else {
        shieldRipple.stop();
      }

      if (busterWindup || sonicBuster) {
        hideShield();
        const reach = body.userData.sonicBusterReach ?? R * LIBRA_BUSTER_RADIUS_MULT;
        pitSpin += dt * (busterWindup ? 2.8 : 4.6);
        pitT += dt;

        const libraWindupDur = effectiveSpecialWindup(LIBRA_BUSTER_WINDUP_DUR);
        const fadeIn = sonicBuster
          ? easeOut(Math.min(1, pitT / 0.22))
          : easeOut(clamp01(pitT / libraWindupDur));
        const fadeOut = sonicBuster
          ? clamp01((LIBRA_BUSTER_DURATION - Math.max(0, pitT - libraWindupDur)) / 0.35)
          : 1;
        const env = fadeIn * Math.max(0, fadeOut);

        const spread = easeOut(clamp01(pitT / LIBRA_BUSTER_SPREAD_DUR));
        const pillarGrow = 0.05 + spread * 0.95;
        updatePillar(body, camera, dt, env, pillarGrow);
        updateSandPit(body, camera, dt, reach, env);

        const pitR = body.userData.sonicBusterSpread ?? libraBusterSandRadius(reach, pitT);
        sandStorm.follow(bx, floorY + 0.4 + pitR * 0.08, bz, env > 0.05);
        if (pitT < 0.05) {
          sandBurst.setPosition(bx, floorY + 0.15, bz);
          sandBurst.burst(28);
        }
        // Piercing shriek pulses — radial particle shockwaves (canon Sonic Buster).
        if (sonicBuster && env > 0.2) {
          lastShriekPulse += dt;
          if (lastShriekPulse > 0.55) {
            lastShriekPulse = 0;
            shriekPulse.setPosition(bx, floorY + 0.35 + pitR * 0.05, bz);
            shriekPulse.burst(22 + Math.floor(spread * 16));
          }
        }
      } else {
        sandStorm.stop();
        lastShriekPulse = 0;
      }
    },
    reset,
  };
}
