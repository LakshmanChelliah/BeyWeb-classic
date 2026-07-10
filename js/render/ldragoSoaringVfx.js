/**
 * Lightning L-Drago — Dragon Emperor, Soaring Destruction VFX.
 * Fair-fight mirror of Star Blast: dash → wall → soar → dive → bounce,
 * themed dark purple/crimson with dragon silhouette apex + lightning impact twist.
 * No flat impact rings — reach is sold by trails, dragon motif, and particle volume.
 */
import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';
import {
  createBurstSystem,
  createTrailSystem,
  ensureQuarksRuntime,
  Vector4,
} from './vfx/quarksRuntime.js';

const _pos = new THREE.Vector3();
const _lastPos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _smoothVel = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _smoothDir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _ghostPos = new THREE.Vector3();
const _hint = new THREE.Vector3();
const _boltA = new THREE.Vector3();
const _boltB = new THREE.Vector3();

const HISTORY_LEN = 20;
const VIOLET = 0x5b21d9;
const VIOLET_LIGHT = 0x7c3aed;
const LILAC = 0xb794f4;
const CRIMSON = 0x9f1239;
const WHITE_HOT = 0xfaf5ff;

function makeTrailMat(color, opacity) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** Dragon-silhouette apex motif (dark counterpart to Pegasus 4-ray star). */
function createDragonApexTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  const cx = 128;
  const cy = 128;

  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 100);
  bloom.addColorStop(0, 'rgba(183,148,244,0.5)');
  bloom.addColorStop(0.4, 'rgba(91,33,217,0.28)');
  bloom.addColorStop(1, 'rgba(91,33,217,0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(cx, cy, 100, 0, Math.PI * 2);
  ctx.fill();

  // Spread wings
  ctx.fillStyle = 'rgba(159,18,57,0.75)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 10);
  ctx.bezierCurveTo(40, cy - 55, 6, cy + 18, 22, cy + 58);
  ctx.lineTo(cx - 16, cy + 14);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 10);
  ctx.bezierCurveTo(216, cy - 55, 250, cy + 18, 234, cy + 58);
  ctx.lineTo(cx + 16, cy + 14);
  ctx.closePath();
  ctx.fill();

  // Inner wing glow
  ctx.fillStyle = 'rgba(124,58,237,0.55)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.bezierCurveTo(60, cy - 30, 36, cy + 8, 50, cy + 40);
  ctx.lineTo(cx - 10, cy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cx, cy - 6);
  ctx.bezierCurveTo(196, cy - 30, 220, cy + 8, 206, cy + 40);
  ctx.lineTo(cx + 10, cy + 10);
  ctx.closePath();
  ctx.fill();

  // Head / neck
  ctx.fillStyle = 'rgba(250,245,255,0.92)';
  ctx.beginPath();
  ctx.moveTo(cx, cy - 70);
  ctx.bezierCurveTo(cx - 24, cy - 42, cx - 30, cy - 8, cx - 12, cy + 10);
  ctx.lineTo(cx + 12, cy + 10);
  ctx.bezierCurveTo(cx + 30, cy - 8, cx + 24, cy - 42, cx, cy - 70);
  ctx.closePath();
  ctx.fill();

  // Eye glints
  ctx.fillStyle = 'rgba(254,226,226,0.95)';
  ctx.beginPath();
  ctx.ellipse(cx - 9, cy - 32, 4, 3, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx + 9, cy - 32, 4, 3, 0.3, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function boltRand(seed) {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453;
  return (x - Math.floor(x)) * 2 - 1;
}

function buildBoltPoints(seed, x, z, topY, bottomY, spread) {
  const pts = [];
  const segs = 14;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const y = topY + (bottomY - topY) * t;
    const wobble = (1 - t * 0.55) * spread;
    const ox = boltRand(seed + i * 3.1) * wobble;
    const oz = boltRand(seed + i * 5.7 + 11) * wobble;
    pts.push(new THREE.Vector3(x + ox, y, z + oz));
  }
  return pts;
}

function buildBranchPoints(seed, mainPts, startIdx, spread) {
  const start = mainPts[Math.min(startIdx, mainPts.length - 1)];
  const dir = boltRand(seed) > 0 ? 1 : -1;
  const pts = [start.clone()];
  const segs = 7;
  for (let i = 1; i <= segs; i++) {
    const t = i / segs;
    pts.push(
      new THREE.Vector3(
        start.x + dir * spread * t * (0.55 + boltRand(seed + i) * 0.45),
        start.y - t * (2.8 + boltRand(seed + i + 3) * 1.4),
        start.z + boltRand(seed + i + 7) * spread * 0.4 * t
      )
    );
  }
  return pts;
}

function makeBoltLine(color, segs = 14) {
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array((segs + 1) * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  line.renderOrder = 12;
  line.frustumCulled = false;
  return line;
}

export function createLdragoSoaringVfx(scene) {
  ensureQuarksRuntime(scene);
  const root = new THREE.Group();
  scene.add(root);

  const ghosts = [];
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.1),
      makeTrailMat(VIOLET_LIGHT, 0.38 - i * 0.05)
    );
    mesh.visible = false;
    mesh.renderOrder = 4;
    root.add(mesh);
    ghosts.push(mesh);
  }

  const streaks = [];
  for (let i = 0; i < 12; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 2.4),
      makeTrailMat(i % 3 === 0 ? CRIMSON : LILAC, 0.55 - i * 0.035)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    streaks.push(mesh);
  }

  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 3.8),
    makeTrailMat(VIOLET, 0.28)
  );
  ribbon.visible = false;
  ribbon.renderOrder = 3;
  root.add(ribbon);

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    makeTrailMat(WHITE_HOT, 0.5)
  );
  core.visible = false;
  core.renderOrder = 6;
  root.add(core);

  // Dark dragon spirit wings (counterpart to Pegasus spirit wings).
  const spiritWings = [];
  for (let i = 0; i < 4; i++) {
    const wing = new THREE.Mesh(
      new THREE.PlaneGeometry(i < 2 ? 3.1 : 2.2, i < 2 ? 1.75 : 1.2),
      makeTrailMat(i < 2 ? CRIMSON : VIOLET_LIGHT, 0)
    );
    wing.visible = false;
    wing.renderOrder = 3;
    root.add(wing);
    spiritWings.push(wing);
  }

  // Electrified body glow during dive.
  const bodyGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    makeTrailMat(VIOLET, 0)
  );
  bodyGlow.visible = false;
  bodyGlow.renderOrder = 4;
  root.add(bodyGlow);

  const dragonTex = createDragonApexTexture();
  const apexDragon = new THREE.Mesh(
    new THREE.PlaneGeometry(7.2, 7.2),
    new THREE.MeshBasicMaterial({
      map: dragonTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  apexDragon.visible = false;
  apexDragon.renderOrder = 8;
  root.add(apexDragon);

  const dragonBloom = new THREE.Mesh(
    new THREE.PlaneGeometry(10.2, 10.2),
    makeTrailMat(VIOLET_LIGHT, 0)
  );
  dragonBloom.visible = false;
  dragonBloom.renderOrder = 7;
  root.add(dragonBloom);

  const apexFlare = new THREE.Mesh(
    new THREE.PlaneGeometry(10.5, 1.15),
    makeTrailMat(WHITE_HOT, 0)
  );
  apexFlare.visible = false;
  apexFlare.renderOrder = 7;
  root.add(apexFlare);

  // Impact + continuous crackle bolts (dive / wall / soar electrify).
  const IMPACT_BOLT_COUNT = 12;
  const BRANCH_BOLT_COUNT = 10;
  const CRACKLE_BOLT_COUNT = 8;
  const impactBolts = [];
  for (let i = 0; i < IMPACT_BOLT_COUNT; i++) {
    const line = makeBoltLine(
      i === 0 ? WHITE_HOT : i < 4 ? LILAC : i < 8 ? VIOLET_LIGHT : CRIMSON,
      14
    );
    root.add(line);
    impactBolts.push(line);
  }
  const branchBolts = [];
  for (let i = 0; i < BRANCH_BOLT_COUNT; i++) {
    const line = makeBoltLine(i % 2 === 0 ? LILAC : WHITE_HOT, 7);
    line.renderOrder = 11;
    root.add(line);
    branchBolts.push(line);
  }
  const crackleBolts = [];
  for (let i = 0; i < CRACKLE_BOLT_COUNT; i++) {
    const line = makeBoltLine(i % 2 === 0 ? VIOLET_LIGHT : LILAC, 10);
    line.renderOrder = 10;
    root.add(line);
    crackleBolts.push(line);
  }

  // Thick bolt ribbons — LineBasicMaterial is 1px on WebGL; planes sell mass.
  const BOLT_RIBBON_COUNT = 6;
  const boltRibbons = [];
  for (let i = 0; i < BOLT_RIBBON_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18 + (i % 3) * 0.06, 14),
      makeTrailMat(i < 2 ? WHITE_HOT : i < 4 ? LILAC : VIOLET_LIGHT, 0)
    );
    mesh.visible = false;
    mesh.renderOrder = 13;
    root.add(mesh);
    boltRibbons.push(mesh);
  }
  const CRACKLE_RIBBON_COUNT = 4;
  const crackleRibbons = [];
  for (let i = 0; i < CRACKLE_RIBBON_COUNT; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1 + (i % 2) * 0.04, 5.5),
      makeTrailMat(i % 2 === 0 ? LILAC : WHITE_HOT, 0)
    );
    mesh.visible = false;
    mesh.renderOrder = 11;
    root.add(mesh);
    crackleRibbons.push(mesh);
  }

  const skyFlash = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 2.8),
    makeTrailMat(WHITE_HOT, 0)
  );
  skyFlash.visible = false;
  skyFlash.renderOrder = 11;
  root.add(skyFlash);

  const skyFlashOuter = new THREE.Mesh(
    new THREE.PlaneGeometry(8.5, 4.2),
    makeTrailMat(VIOLET_LIGHT, 0)
  );
  skyFlashOuter.visible = false;
  skyFlashOuter.renderOrder = 10;
  root.add(skyFlashOuter);

  const diveTrail = createTrailSystem(scene, {
    rate: 95,
    startSize: [0.3, 0.85],
    startLife: [0.22, 0.5],
    colorA: new Vector4(0.55, 0.25, 0.95, 1),
    colorB: new Vector4(0.95, 0.35, 0.45, 0),
  });

  const bounceDust = createBurstSystem(scene, {
    additive: false,
    dustyColor: 0x4c1d95,
    startSpeed: [4, 12],
    startSize: [0.25, 0.85],
    gravity: -16,
    coneAngle: 1.25,
    colorA: new Vector4(0.45, 0.22, 0.65, 0.95),
    colorB: new Vector4(0.25, 0.12, 0.35, 0),
  });

  const bounceSparks = createBurstSystem(scene, {
    additive: true,
    startSpeed: [6, 18],
    startSize: [0.1, 0.35],
    gravity: -5,
    colorA: new Vector4(0.85, 0.7, 1, 1),
    colorB: new Vector4(0.55, 0.2, 0.95, 0),
  });

  const apexBurst = createBurstSystem(scene, {
    additive: true,
    startSpeed: [5, 16],
    startSize: [0.15, 0.55],
    gravity: -2,
    coneAngle: 1.5,
    colorA: new Vector4(0.95, 0.85, 1, 1),
    colorB: new Vector4(0.55, 0.15, 0.9, 0),
  });

  const lightningBurst = createBurstSystem(scene, {
    additive: true,
    startSpeed: [10, 28],
    startSize: [0.14, 0.55],
    gravity: -3,
    coneAngle: 1.75,
    colorA: new Vector4(1, 0.95, 1, 1),
    colorB: new Vector4(0.6, 0.3, 1, 0),
  });

  const crackleBurst = createBurstSystem(scene, {
    additive: true,
    startSpeed: [4, 14],
    startSize: [0.08, 0.28],
    gravity: -1,
    coneAngle: 1.8,
    colorA: new Vector4(0.95, 0.85, 1, 1),
    colorB: new Vector4(0.5, 0.25, 0.95, 0),
  });

  const history = Array.from({ length: HISTORY_LEN }, () => new THREE.Vector3());
  let historyCount = 0;
  let hasLast = false;
  let smoothSpeed = 0;
  let lastPhase = null;
  let lastBouncePulse = -1;
  let lastLightningPulse = false;
  let lastApexCharge = false;
  let crackleAcc = 0;

  function phaseHint(body, phase, out) {
    out.set(0, 0, 0);
    if (phase === 'ascend') {
      out.y = 28;
    } else if (phase === 'dive') {
      out.y = -34;
    } else if (phase === 'dash') {
      const nx = body.userData.ldragoWallNx ?? 0;
      const nz = body.userData.ldragoWallNz ?? 0;
      out.set(-nx * 34, 0, -nz * 34);
    }
  }

  function phaseStyle(phase) {
    if (phase === 'ascend') return { tint: VIOLET_LIGHT, intensity: 1.05, ribbon: 1.2 };
    if (phase === 'dive') return { tint: LILAC, intensity: 1.4, ribbon: 1.55 };
    if (phase === 'bounce') return { tint: WHITE_HOT, intensity: 0.75, ribbon: 0.55 };
    return { tint: VIOLET, intensity: 0.9, ribbon: 0.95 };
  }

  function reset() {
    root.visible = false;
    historyCount = 0;
    hasLast = false;
    smoothSpeed = 0;
    lastPhase = null;
    lastBouncePulse = -1;
    lastLightningPulse = false;
    lastApexCharge = false;
    crackleAcc = 0;
    _smoothVel.set(0, 0, 0);
    _smoothDir.set(0, 0, -1);
    for (const g of ghosts) g.visible = false;
    for (const s of streaks) s.visible = false;
    for (const w of spiritWings) {
      w.visible = false;
      w.material.opacity = 0;
    }
    for (const b of impactBolts) {
      b.visible = false;
      b.material.opacity = 0;
    }
    for (const b of branchBolts) {
      b.visible = false;
      b.material.opacity = 0;
    }
    for (const b of crackleBolts) {
      b.visible = false;
      b.material.opacity = 0;
    }
    for (const r of boltRibbons) {
      r.visible = false;
      r.material.opacity = 0;
    }
    for (const r of crackleRibbons) {
      r.visible = false;
      r.material.opacity = 0;
    }
    bodyGlow.visible = false;
    bodyGlow.material.opacity = 0;
    ribbon.visible = false;
    core.visible = false;
    apexDragon.visible = false;
    apexDragon.material.opacity = 0;
    dragonBloom.visible = false;
    dragonBloom.material.opacity = 0;
    apexFlare.visible = false;
    apexFlare.material.opacity = 0;
    skyFlash.visible = false;
    skyFlash.material.opacity = 0;
    skyFlashOuter.visible = false;
    skyFlashOuter.material.opacity = 0;
    diveTrail.stop();
  }

  function sampleHistory(t, target) {
    if (historyCount < 2) {
      target.copy(_pos);
      return;
    }
    const maxIdx = historyCount - 1;
    const f = t * maxIdx;
    const i0 = Math.floor(f);
    const i1 = Math.min(i0 + 1, maxIdx);
    const frac = f - i0;
    target.lerpVectors(history[i0], history[i1], frac);
  }

  function billboard(mesh, camera) {
    mesh.quaternion.copy(camera.quaternion);
  }

  function writeBolt(line, points) {
    line.geometry.setFromPoints(points);
    line.geometry.computeBoundingSphere();
  }

  return {
    update(topGroup, body, camera, dt) {
      if (!topGroup || !body || !camera) {
        reset();
        return;
      }

      const phase = body.userData.ldragoPhase;
      const active =
        phase === 'dash' ||
        phase === 'ascend' ||
        phase === 'dive' ||
        phase === 'bounce' ||
        phase === 'settle' ||
        body.userData.ldragoImpactFlash ||
        body.userData.ldragoSoaringWindup ||
        (body.userData.ldragoLightningImpactT ?? 0) > 0;
      if (!active) {
        reset();
        return;
      }

      root.visible = true;
      topGroup.getWorldPosition(_pos);

      if (phase !== lastPhase) {
        if (phase === 'bounce' || (phase === 'ascend' && lastPhase === 'dash')) {
          bounceDust.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.15, _pos.z);
          bounceDust.burst(phase === 'bounce' ? 48 : 28);
          bounceSparks.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.2, _pos.z);
          bounceSparks.burst(phase === 'bounce' ? 36 : 20);
        }
        if (phase === 'ascend' && lastPhase === 'dash') {
          apexBurst.setPosition(_pos.x, _pos.y + 1.2, _pos.z);
          apexBurst.burst(36);
          lightningBurst.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.35, _pos.z);
          lightningBurst.burst(36);
        }
        if (phase === 'dive' && lastPhase === 'ascend') {
          apexBurst.setPosition(_pos.x, _pos.y + 1.6, _pos.z);
          apexBurst.burst(48);
          lightningBurst.setPosition(_pos.x, _pos.y + 0.5, _pos.z);
          lightningBurst.burst(40);
        }
        lastPhase = phase;
      }

      if (phase === 'bounce') {
        const pulse = body.userData.ldragoBouncePulseT ?? 0;
        if (pulse < 0.05 && lastBouncePulse > 0.1) {
          const speed = Math.abs(body.userData.ldragoVY ?? 8);
          bounceDust.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.12, _pos.z);
          bounceDust.burst(12 + Math.floor(speed * 1.5));
          bounceSparks.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.18, _pos.z);
          bounceSparks.burst(8 + Math.floor(speed));
        }
        lastBouncePulse = pulse;
      }

      // Apex charge spark burst (lightning twist before dive).
      const apexCharge = (body.userData.ldragoApexChargeT ?? 0) > 0.4;
      if (apexCharge && !lastApexCharge) {
        apexBurst.setPosition(_pos.x, _pos.y + 1.8, _pos.z);
        apexBurst.burst(40);
        lightningBurst.setPosition(_pos.x, _pos.y + 0.8, _pos.z);
        lightningBurst.burst(48);
      }
      lastApexCharge = apexCharge;

      // Continuous crackle during soar / dive / apex charge (electrified dragon).
      // Stadium camera pullback makes near-bey arcs tiny — use sky→floor columns.
      const crackleOn =
        phase === 'ascend' ||
        phase === 'dive' ||
        apexCharge ||
        (body.userData.ldragoApexChargeT ?? 0) > 0.05;
      if (crackleOn) {
        crackleAcc += dt;
        const flicker = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() * 0.065));
        const liftFrac = clamp01((body.userData.flightLift ?? 0) / 38);
        const cracklePow =
          (phase === 'dive' ? 0.85 : 0.55 + liftFrac * 0.4) * flicker;
        const seed = Math.floor(performance.now() * 0.045);
        const topY = CONFIG.FLOOR_Y + 24 + liftFrac * 6;
        const botY = CONFIG.FLOOR_Y + 0.12;
        crackleBolts.forEach((line, bi) => {
          const spread = 1.1 + bi * 0.35;
          const ring = 0.4 + bi * 0.55;
          const ang = (bi / CRACKLE_BOLT_COUNT) * Math.PI * 2 + performance.now() * 0.003;
          const ox = Math.cos(ang) * ring + boltRand(seed + bi * 5.3) * 0.35;
          const oz = Math.sin(ang) * ring + boltRand(seed + bi * 7.1) * 0.35;
          writeBolt(
            line,
            buildBoltPoints(seed + bi * 9, _pos.x + ox, _pos.z + oz, topY, botY, spread)
          );
          line.material.opacity = cracklePow * (1 - bi * 0.06);
          line.visible = line.material.opacity > 0.03;
        });
        crackleRibbons.forEach((ribbonMesh, ri) => {
          const ang = (ri / CRACKLE_RIBBON_COUNT) * Math.PI * 2 + performance.now() * 0.004;
          const ring = 0.25 + ri * 0.4;
          ribbonMesh.visible = true;
          ribbonMesh.position.set(
            _pos.x + Math.cos(ang) * ring,
            (topY + botY) * 0.5,
            _pos.z + Math.sin(ang) * ring
          );
          ribbonMesh.rotation.order = 'YXZ';
          ribbonMesh.rotation.y = ang + Math.PI * 0.5;
          ribbonMesh.rotation.x = -Math.PI * 0.48 + boltRand(seed + ri) * 0.1;
          ribbonMesh.rotation.z = boltRand(seed + ri * 2) * 0.18;
          const h = topY - botY;
          ribbonMesh.scale.set(1.35 + flicker * 0.5, h / 5.5, 1);
          ribbonMesh.material.opacity = cracklePow * (0.65 - ri * 0.08);
        });
        if (crackleAcc > 0.08) {
          crackleAcc = 0;
          crackleBurst.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.35, _pos.z);
          crackleBurst.burst(phase === 'dive' ? 22 : 14);
          crackleBurst.setPosition(_pos.x, _pos.y + 0.3, _pos.z);
          crackleBurst.burst(phase === 'dive' ? 12 : 8);
        }
      } else {
        for (const b of crackleBolts) {
          b.visible = false;
          b.material.opacity = 0;
        }
        for (const r of crackleRibbons) {
          r.visible = false;
          r.material.opacity = 0;
        }
        crackleAcc = 0;
      }

      // Dive / wall lightning impact twist — denser main + branch bolts + thick ribbons.
      const impactT = body.userData.ldragoLightningImpactT ?? 0;
      if (impactT > 0.02) {
        const flicker = 0.55 + 0.45 * Math.abs(Math.sin(performance.now() * 0.06));
        const pow = impactT * flicker;
        const seed = Math.floor(performance.now() * 0.03);
        const topY = CONFIG.FLOOR_Y + 28;
        const botY = CONFIG.FLOOR_Y + 0.1;
        if (impactT > 0.5 && !lastLightningPulse) {
          lightningBurst.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.4, _pos.z);
          lightningBurst.burst(72);
          crackleBurst.setPosition(_pos.x, _pos.y + 0.6, _pos.z);
          crackleBurst.burst(36);
          lastLightningPulse = true;
        }
        if (impactT < 0.12) lastLightningPulse = false;

        let mainPath = null;
        impactBolts.forEach((line, bi) => {
          const spread = 1.5 + bi * 0.3;
          const ox = boltRand(seed + bi * 4.1) * spread * 0.45;
          const oz = boltRand(seed + bi * 6.3) * spread * 0.45;
          const pts = buildBoltPoints(
            seed + bi * 7,
            _pos.x + ox,
            _pos.z + oz,
            topY,
            botY,
            spread
          );
          if (bi === 0) mainPath = pts;
          writeBolt(line, pts);
          line.material.opacity = pow * (bi === 0 ? 1 : Math.max(0.22, 0.88 - bi * 0.06));
          line.visible = line.material.opacity > 0.02;
        });

        if (mainPath) {
          branchBolts.forEach((line, bi) => {
            const startIdx = 3 + (bi % 6);
            writeBolt(
              line,
              buildBranchPoints(seed + 40 + bi * 11, mainPath, startIdx, 1.55 + bi * 0.2)
            );
            line.material.opacity = pow * (0.75 - bi * 0.05);
            line.visible = line.material.opacity > 0.02;
          });
        }

        boltRibbons.forEach((ribbonMesh, ri) => {
          const ang = (ri / BOLT_RIBBON_COUNT) * Math.PI * 2 + boltRand(seed + ri) * 0.4;
          const off = 0.2 + ri * 0.12;
          ribbonMesh.visible = true;
          ribbonMesh.position.set(
            _pos.x + Math.cos(ang) * off,
            (topY + botY) * 0.5,
            _pos.z + Math.sin(ang) * off
          );
          ribbonMesh.rotation.order = 'YXZ';
          ribbonMesh.rotation.y = ang + Math.PI * 0.5;
          ribbonMesh.rotation.x = -Math.PI * 0.48 + boltRand(seed + ri * 2) * 0.12;
          ribbonMesh.rotation.z = boltRand(seed + ri * 3) * 0.15;
          const h = topY - botY;
          ribbonMesh.scale.set(1.3 + pow * 0.6, h / 14, 1);
          ribbonMesh.material.opacity = pow * (0.7 - ri * 0.07);
        });

        skyFlash.position.set(_pos.x, topY - 0.6, _pos.z);
        billboard(skyFlash, camera);
        skyFlash.scale.set(2.1 + impactT * 2.6, 1.0 + impactT * 1.2, 1);
        skyFlash.material.opacity = pow * 0.95;
        skyFlash.visible = true;

        skyFlashOuter.position.set(_pos.x, topY - 0.2, _pos.z);
        billboard(skyFlashOuter, camera);
        skyFlashOuter.scale.set(2.8 + impactT * 3.0, 1.3 + impactT * 1.5, 1);
        skyFlashOuter.material.opacity = pow * 0.5;
        skyFlashOuter.visible = true;
      } else {
        for (const b of impactBolts) {
          b.visible = false;
          b.material.opacity = 0;
        }
        for (const b of branchBolts) {
          b.visible = false;
          b.material.opacity = 0;
        }
        for (const r of boltRibbons) {
          r.visible = false;
          r.material.opacity = 0;
        }
        skyFlash.visible = false;
        skyFlash.material.opacity = 0;
        skyFlashOuter.visible = false;
        skyFlashOuter.material.opacity = 0;
        lastLightningPulse = false;
      }

      if (hasLast) {
        _vel.subVectors(_pos, _lastPos).divideScalar(Math.max(dt, 0.001));
      } else {
        _vel.set(0, 0, 0);
        hasLast = true;
      }
      _lastPos.copy(_pos);

      phaseHint(body, phase, _hint);
      if (_vel.length() < 10 && _hint.lengthSq() > 0) {
        _vel.lerp(_hint, phase === 'dash' ? 0.62 : 0.78);
      }

      const blend = 1 - Math.exp(-16 * dt);
      _smoothVel.lerp(_vel, blend);
      smoothSpeed += (_smoothVel.length() - smoothSpeed) * blend;

      if (_smoothVel.lengthSq() > 0.25) {
        _dir.copy(_smoothVel).normalize();
      } else if (_hint.lengthSq() > 0) {
        _dir.copy(_hint).normalize();
      }
      _smoothDir.lerp(_dir, blend);
      if (_smoothDir.lengthSq() > 1e-6) _smoothDir.normalize();

      for (let i = Math.min(historyCount, HISTORY_LEN - 1); i > 0; i--) {
        history[i].copy(history[i - 1]);
      }
      history[0].copy(_pos);
      historyCount = Math.min(historyCount + 1, HISTORY_LEN);

      const style = phaseStyle(phase);
      const lift = body.userData.flightLift ?? 0;
      const speedFactor = clamp01(smoothSpeed / 28);
      const intensity =
        style.intensity * (0.5 + speedFactor * 0.45 + Math.min(lift, 38) / 38 * 0.2);

      _right.crossVectors(_smoothDir, camera.up).normalize();
      if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);

      const showTrail = phase === 'dash' || phase === 'ascend' || phase === 'dive';
      for (let i = 0; i < ghosts.length; i++) {
        const ghost = ghosts[i];
        const t = (i + 1) / (ghosts.length + 0.5);
        sampleHistory(t * 0.8, _ghostPos);
        ghost.visible = showTrail && historyCount > 2;
        if (!ghost.visible) continue;
        ghost.position.copy(_ghostPos).addScaledVector(_smoothDir, -t * 1.35);
        billboard(ghost, camera);
        const s = topGroup.scale.x * (1.0 - t * 0.14);
        ghost.scale.set(s, s, s);
        ghost.material.color.setHex(i % 2 === 0 ? style.tint : CRIMSON);
        ghost.material.opacity = Math.max(0.04, (0.4 - t * 0.28) * intensity);
      }

      const streakLen = 0.85 + speedFactor * 2.4 * style.ribbon;
      const yaw = Math.atan2(_smoothDir.x, _smoothDir.z);
      const pitch = -Math.asin(Math.max(-1, Math.min(1, _smoothDir.y)));

      for (let i = 0; i < streaks.length; i++) {
        const streak = streaks[i];
        const t = i / Math.max(1, streaks.length - 1);
        const show = showTrail && (smoothSpeed > 0.8 || phase !== 'dash');
        streak.visible = show;
        if (!show) continue;
        const back = 0.3 + t * 3.2;
        const fan = (i - (streaks.length - 1) * 0.5) * 0.1;
        streak.position.copy(_pos);
        streak.position.addScaledVector(_smoothDir, -back);
        streak.position.addScaledVector(_right, fan);
        streak.rotation.order = 'YXZ';
        streak.rotation.y = yaw;
        streak.rotation.x = pitch * 0.65;
        streak.rotation.z = fan * 0.3;
        streak.scale.set(1, streakLen * (1 - t * 0.32), 1);
        streak.material.color.setHex(style.tint);
        streak.material.opacity = Math.max(0.05, (0.55 - t * 0.42) * intensity);
      }

      const ribbonShow = showTrail && (smoothSpeed > 1.2 || phase === 'ascend' || phase === 'dive');
      ribbon.visible = ribbonShow;
      if (ribbonShow) {
        ribbon.position.copy(_pos).addScaledVector(_smoothDir, -1.15);
        ribbon.scale.set(0.85 + speedFactor * 0.55, 1.1 + speedFactor * 1.6 * style.ribbon, 1);
        ribbon.material.color.setHex(style.tint);
        ribbon.material.opacity = 0.14 + speedFactor * 0.2 * intensity;
        billboard(ribbon, camera);
      }

      const spiritOn = phase === 'ascend' || phase === 'dive';
      for (let i = 0; i < spiritWings.length; i++) {
        const wing = spiritWings[i];
        wing.visible = spiritOn;
        if (!spiritOn) continue;
        const pair = i % 2;
        const layer = Math.floor(i / 2);
        const side = pair === 0 ? -1 : 1;
        const flap = Math.sin(performance.now() * 0.012 + i) * 0.35;
        wing.position.copy(_pos);
        wing.position.addScaledVector(_right, side * (1.45 + flap * 0.22 + layer * 0.15));
        wing.position.addScaledVector(_smoothDir, -0.55 - layer * 0.85);
        wing.position.y += 0.45 - layer * 0.1;
        billboard(wing, camera);
        const layerScale = 1 - layer * 0.18;
        wing.scale.set(
          (1.2 + speedFactor * 0.45) * layerScale,
          (0.75 + Math.abs(flap) * 0.35) * layerScale,
          1
        );
        wing.material.opacity = (0.24 + intensity * 0.3) * (1 - layer * 0.35);
      }

      const glowOn = phase === 'dive' || (phase === 'ascend' && lift > 20) || impactT > 0.2;
      bodyGlow.visible = glowOn;
      if (glowOn) {
        bodyGlow.position.copy(_pos);
        billboard(bodyGlow, camera);
        const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.08;
        bodyGlow.scale.setScalar(topGroup.scale.x * (1.1 + speedFactor * 0.4) * pulse);
        bodyGlow.material.color.setHex(impactT > 0.3 || phase === 'dive' ? WHITE_HOT : VIOLET);
        bodyGlow.material.opacity =
          phase === 'dive' ? 0.42 + intensity * 0.28 : impactT > 0.2 ? 0.32 : 0.22;
      } else {
        bodyGlow.material.opacity = 0;
      }

      core.visible = showTrail;
      if (showTrail) {
        core.position.copy(_pos);
        billboard(core, camera);
        core.scale.setScalar(topGroup.scale.x * (0.55 + speedFactor * 0.35));
        core.material.color.setHex(phase === 'dive' ? LILAC : WHITE_HOT);
        core.material.opacity = 0.16 + speedFactor * 0.35 * intensity;
      }

      if (phase === 'dive' || phase === 'ascend') {
        diveTrail.follow(_pos.x, _pos.y, _pos.z, true);
      } else {
        diveTrail.stop();
      }

      // Apex dragon silhouette — counterpart to Pegasus 4-ray star.
      const apexFrac = lift / 38;
      const showDragon =
        (phase === 'ascend' && apexFrac > 0.4) || (phase === 'dive' && apexFrac > 0.5);
      apexDragon.visible = showDragon;
      dragonBloom.visible = showDragon;
      apexFlare.visible = showDragon;
      if (showDragon) {
        apexDragon.position.copy(_pos);
        apexDragon.position.y += 1.55;
        billboard(apexDragon, camera);
        dragonBloom.position.copy(apexDragon.position);
        billboard(dragonBloom, camera);
        apexFlare.position.copy(apexDragon.position);
        billboard(apexFlare, camera);
        const starLife =
          phase === 'ascend'
            ? clamp01((apexFrac - 0.4) / 0.6)
            : clamp01((apexFrac - 0.5) / 0.5);
        const spin = performance.now() * 0.001;
        // Slow counter-spin for left-spin dragon feel.
        apexDragon.rotation.z = -spin;
        dragonBloom.rotation.z = spin * 0.35;
        apexFlare.rotation.z = -spin * 0.5 + Math.PI / 4;
        apexDragon.scale.setScalar(1.5 + starLife * 1.1);
        dragonBloom.scale.setScalar(1.3 + starLife * 0.8);
        apexFlare.scale.set(1.1 + starLife * 0.9, 0.7 + starLife * 0.4, 1);
        apexDragon.material.opacity = 0.9 * starLife * (phase === 'dive' ? 0.82 : 1);
        dragonBloom.material.opacity = 0.38 * starLife;
        apexFlare.material.opacity = 0.3 * starLife;
      } else {
        apexDragon.material.opacity = 0;
        dragonBloom.material.opacity = 0;
        apexFlare.material.opacity = 0;
      }
    },
    reset,
  };
}
