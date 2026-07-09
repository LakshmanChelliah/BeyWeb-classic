/**
 * Storm Pegasus — Star Blast Attack VFX.
 * Canon: dash → wall → soar → 4-ray star → blue dive → bounce dust.
 * No flat impact rings — reach is sold by trails, star, and particle volume.
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

const HISTORY_LEN = 20;
const BLUE = 0x60a5fa;
const BLUE_LIGHT = 0x7dd3fc;
const BLUE_PALE = 0xbae6fd;
const WHITE = 0xe0f2fe;

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

/** Clean 4-ray star texture for Star Blast apex (canon Shooting Star). */
function createFourRayStarTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  const cx = 128;
  const cy = 128;

  // Soft bloom behind rays.
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
  bloom.addColorStop(0, 'rgba(186,230,253,0.55)');
  bloom.addColorStop(0.45, 'rgba(96,165,250,0.2)');
  bloom.addColorStop(1, 'rgba(96,165,250,0)');
  ctx.fillStyle = bloom;
  ctx.beginPath();
  ctx.arc(cx, cy, 90, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.98)';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -110);
    ctx.lineTo(10, -18);
    ctx.lineTo(0, 0);
    ctx.lineTo(-10, -18);
    ctx.closePath();
    ctx.fill();
    // Secondary thinner rays.
    ctx.beginPath();
    ctx.moveTo(0, -70);
    ctx.lineTo(3, -12);
    ctx.lineTo(0, 0);
    ctx.lineTo(-3, -12);
    ctx.closePath();
    ctx.fillStyle = 'rgba(186,230,253,0.85)';
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.restore();
  }

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 36);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.4, 'rgba(186,230,253,0.7)');
  core.addColorStop(1, 'rgba(96,165,250,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 36, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createStarBlastVfx(scene) {
  ensureQuarksRuntime(scene);
  const root = new THREE.Group();
  scene.add(root);

  const ghosts = [];
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.1, 2.1),
      makeTrailMat(BLUE_LIGHT, 0.38 - i * 0.05)
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
      makeTrailMat(BLUE_PALE, 0.55 - i * 0.035)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    streaks.push(mesh);
  }

  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 3.8),
    makeTrailMat(BLUE, 0.28)
  );
  ribbon.visible = false;
  ribbon.renderOrder = 3;
  root.add(ribbon);

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    makeTrailMat(WHITE, 0.5)
  );
  core.visible = false;
  core.renderOrder = 6;
  root.add(core);

  // Soft spirit wing planes (Pegasus motif trailing the bey).
  const spiritWings = [];
  for (let i = 0; i < 2; i++) {
    const wing = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 1.6),
      makeTrailMat(BLUE_PALE, 0)
    );
    wing.visible = false;
    wing.renderOrder = 3;
    root.add(wing);
    spiritWings.push(wing);
  }

  const starTex = createFourRayStarTexture();
  const apexStar = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshBasicMaterial({
      map: starTex,
      color: 0xffffff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    })
  );
  apexStar.visible = false;
  apexStar.renderOrder = 8;
  root.add(apexStar);

  // Outer star bloom (no ring — soft disc bloom only at apex).
  const starBloom = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 7.5),
    makeTrailMat(BLUE_LIGHT, 0)
  );
  starBloom.visible = false;
  starBloom.renderOrder = 7;
  root.add(starBloom);

  const diveTrail = createTrailSystem(scene, {
    rate: 95,
    startSize: [0.3, 0.85],
    startLife: [0.22, 0.5],
    colorA: new Vector4(0.55, 0.85, 1, 1),
    colorB: new Vector4(0.95, 0.98, 1, 0),
  });

  const bounceDust = createBurstSystem(scene, {
    additive: false,
    dustyColor: 0xd6c4a0,
    startSpeed: [4, 12],
    startSize: [0.25, 0.85],
    gravity: -16,
    coneAngle: 1.25,
    colorA: new Vector4(0.9, 0.82, 0.65, 0.95),
    colorB: new Vector4(0.55, 0.48, 0.35, 0),
  });

  const bounceSparks = createBurstSystem(scene, {
    additive: true,
    startSpeed: [6, 18],
    startSize: [0.1, 0.35],
    gravity: -5,
    colorA: new Vector4(0.8, 0.95, 1, 1),
    colorB: new Vector4(0.4, 0.75, 1, 0),
  });

  const apexBurst = createBurstSystem(scene, {
    additive: true,
    startSpeed: [5, 16],
    startSize: [0.15, 0.55],
    gravity: -2,
    coneAngle: 1.5,
    colorA: new Vector4(0.9, 0.97, 1, 1),
    colorB: new Vector4(0.45, 0.75, 1, 0),
  });

  const history = Array.from({ length: HISTORY_LEN }, () => new THREE.Vector3());
  let historyCount = 0;
  let hasLast = false;
  let smoothSpeed = 0;
  let lastPhase = null;
  let lastBouncePulse = -1;

  function phaseHint(body, phase, out) {
    out.set(0, 0, 0);
    if (phase === 'ascend') {
      out.y = 28;
    } else if (phase === 'dive') {
      out.y = -34;
    } else if (phase === 'dash') {
      const nx = body.userData.starWallNx ?? 0;
      const nz = body.userData.starWallNz ?? 0;
      out.set(-nx * 34, 0, -nz * 34);
    }
  }

  function phaseStyle(phase) {
    if (phase === 'ascend') return { tint: BLUE_LIGHT, intensity: 1.05, ribbon: 1.2 };
    if (phase === 'dive') return { tint: BLUE_PALE, intensity: 1.35, ribbon: 1.5 };
    if (phase === 'bounce') return { tint: WHITE, intensity: 0.75, ribbon: 0.55 };
    return { tint: BLUE, intensity: 0.9, ribbon: 0.95 };
  }

  function reset() {
    root.visible = false;
    historyCount = 0;
    hasLast = false;
    smoothSpeed = 0;
    lastPhase = null;
    lastBouncePulse = -1;
    _smoothVel.set(0, 0, 0);
    _smoothDir.set(0, 0, -1);
    for (const g of ghosts) g.visible = false;
    for (const s of streaks) s.visible = false;
    for (const w of spiritWings) {
      w.visible = false;
      w.material.opacity = 0;
    }
    ribbon.visible = false;
    core.visible = false;
    apexStar.visible = false;
    apexStar.material.opacity = 0;
    starBloom.visible = false;
    starBloom.material.opacity = 0;
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

  return {
    update(topGroup, body, camera, dt) {
      if (!topGroup || !body || !camera) {
        reset();
        return;
      }

      const phase = body.userData.starPhase;
      const active =
        phase === 'dash' ||
        phase === 'ascend' ||
        phase === 'dive' ||
        phase === 'bounce' ||
        phase === 'settle' ||
        body.userData.starImpactFlash;
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
          apexBurst.burst(32);
        }
        if (phase === 'dive' && lastPhase === 'ascend') {
          apexBurst.setPosition(_pos.x, _pos.y + 1.6, _pos.z);
          apexBurst.burst(40);
        }
        lastPhase = phase;
      }

      // Bounce hop dust synced to squash pulse resets.
      if (phase === 'bounce') {
        const pulse = body.userData.starBouncePulseT ?? 0;
        if (pulse < 0.05 && lastBouncePulse > 0.1) {
          const speed = Math.abs(body.userData.starVY ?? 8);
          bounceDust.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.12, _pos.z);
          bounceDust.burst(12 + Math.floor(speed * 1.5));
          bounceSparks.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.18, _pos.z);
          bounceSparks.burst(8 + Math.floor(speed));
        }
        lastBouncePulse = pulse;
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
        ghost.material.color.setHex(style.tint);
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

      // Spirit wings during ascend / dive.
      const spiritOn = phase === 'ascend' || phase === 'dive';
      for (let i = 0; i < spiritWings.length; i++) {
        const wing = spiritWings[i];
        wing.visible = spiritOn;
        if (!spiritOn) continue;
        const side = i === 0 ? -1 : 1;
        const flap = Math.sin(performance.now() * 0.012 + i) * 0.35;
        wing.position.copy(_pos);
        wing.position.addScaledVector(_right, side * (1.4 + flap * 0.2));
        wing.position.addScaledVector(_smoothDir, -0.6);
        wing.position.y += 0.4;
        billboard(wing, camera);
        wing.scale.set(1.1 + speedFactor * 0.4, 0.7 + Math.abs(flap) * 0.3, 1);
        wing.material.opacity = 0.18 + intensity * 0.22;
      }

      core.visible = showTrail;
      if (showTrail) {
        core.position.copy(_pos);
        billboard(core, camera);
        core.scale.setScalar(topGroup.scale.x * (0.55 + speedFactor * 0.35));
        core.material.color.setHex(WHITE);
        core.material.opacity = 0.16 + speedFactor * 0.35 * intensity;
      }

      // Quarks dive comet trail.
      if (phase === 'dive' || phase === 'ascend') {
        diveTrail.follow(_pos.x, _pos.y, _pos.z, true);
      } else {
        diveTrail.stop();
      }

      // Apex 4-ray star — larger, brighter, with bloom (no ground ring).
      const apexFrac = lift / 38;
      const showStar =
        (phase === 'ascend' && apexFrac > 0.45) || (phase === 'dive' && apexFrac > 0.55);
      apexStar.visible = showStar;
      starBloom.visible = showStar;
      if (showStar) {
        apexStar.position.copy(_pos);
        apexStar.position.y += 1.4;
        billboard(apexStar, camera);
        starBloom.position.copy(apexStar.position);
        billboard(starBloom, camera);
        const starLife =
          phase === 'ascend'
            ? clamp01((apexFrac - 0.45) / 0.55)
            : clamp01((apexFrac - 0.55) / 0.45);
        const spin = performance.now() * 0.001;
        apexStar.rotation.z = spin;
        starBloom.rotation.z = -spin * 0.4;
        apexStar.scale.setScalar(1.25 + starLife * 0.85);
        starBloom.scale.setScalar(1.1 + starLife * 0.6);
        apexStar.material.opacity = 0.75 * starLife * (phase === 'dive' ? 0.75 : 1);
        starBloom.material.opacity = 0.28 * starLife;
      }
    },
    reset,
  };
}
