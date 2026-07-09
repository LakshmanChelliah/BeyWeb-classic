import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';

const _pos = new THREE.Vector3();
const _lastPos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _smoothVel = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _smoothDir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _ghostPos = new THREE.Vector3();
const _hint = new THREE.Vector3();

const HISTORY_LEN = 16;
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
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 128, 128);
  const cx = 64;
  const cy = 64;

  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 - Math.PI / 2;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(0, -52);
    ctx.lineTo(5, -8);
    ctx.lineTo(0, 0);
    ctx.lineTo(-5, -8);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 18);
  core.addColorStop(0, 'rgba(255,255,255,0.95)');
  core.addColorStop(0.45, 'rgba(186,230,253,0.55)');
  core.addColorStop(1, 'rgba(96,165,250,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 18, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Speed lines, afterimages, apex 4-ray star, and dive ribbon for Star Blast. */
export function createStarBlastVfx(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const ghosts = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 1.9),
      makeTrailMat(BLUE_LIGHT, 0.32 - i * 0.06)
    );
    mesh.visible = false;
    mesh.renderOrder = 4;
    root.add(mesh);
    ghosts.push(mesh);
  }

  const streaks = [];
  for (let i = 0; i < 9; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.045, 2.0),
      makeTrailMat(BLUE_PALE, 0.48 - i * 0.04)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    streaks.push(mesh);
  }

  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 3.1),
    makeTrailMat(BLUE, 0.22)
  );
  ribbon.visible = false;
  ribbon.renderOrder = 3;
  root.add(ribbon);

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(1.45, 1.45),
    makeTrailMat(WHITE, 0.4)
  );
  core.visible = false;
  core.renderOrder = 6;
  root.add(core);

  const starTex = createFourRayStarTexture();
  const apexStar = new THREE.Mesh(
    new THREE.PlaneGeometry(3.4, 3.4),
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

  const impactRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.85, 36),
    makeTrailMat(WHITE, 0)
  );
  impactRing.rotation.x = -Math.PI / 2;
  impactRing.visible = false;
  impactRing.renderOrder = 7;
  root.add(impactRing);

  const history = Array.from({ length: HISTORY_LEN }, () => new THREE.Vector3());
  let historyCount = 0;
  let hasLast = false;
  let smoothSpeed = 0;
  let impactT = 0;
  let lastPhase = null;

  function phaseHint(body, phase, out) {
    out.set(0, 0, 0);
    if (phase === 'ascend') {
      out.y = 26;
    } else if (phase === 'dive') {
      out.y = -30;
    } else if (phase === 'dash') {
      const nx = body.userData.starWallNx ?? 0;
      const nz = body.userData.starWallNz ?? 0;
      out.set(-nx * 32, 0, -nz * 32);
    }
  }

  function phaseStyle(phase) {
    if (phase === 'ascend') return { tint: BLUE_LIGHT, intensity: 0.95, ribbon: 1.1 };
    if (phase === 'dive') return { tint: BLUE_PALE, intensity: 1.2, ribbon: 1.35 };
    if (phase === 'bounce') return { tint: WHITE, intensity: 0.7, ribbon: 0.6 };
    return { tint: BLUE, intensity: 0.85, ribbon: 0.9 };
  }

  function reset() {
    root.visible = false;
    historyCount = 0;
    hasLast = false;
    smoothSpeed = 0;
    impactT = 0;
    lastPhase = null;
    _smoothVel.set(0, 0, 0);
    _smoothDir.set(0, 0, -1);
    for (const g of ghosts) g.visible = false;
    for (const s of streaks) s.visible = false;
    ribbon.visible = false;
    core.visible = false;
    apexStar.visible = false;
    apexStar.material.opacity = 0;
    impactRing.visible = false;
    impactRing.material.opacity = 0;
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
        body.userData.starImpactFlash;
      if (!active) {
        reset();
        return;
      }

      root.visible = true;
      topGroup.getWorldPosition(_pos);

      if (phase !== lastPhase) {
        if (phase === 'bounce' || (phase === 'ascend' && lastPhase === 'dash')) {
          impactT = 0.22;
        }
        lastPhase = phase;
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
      const intensity = style.intensity * (0.5 + speedFactor * 0.45 + Math.min(lift, 38) / 38 * 0.15);

      _right.crossVectors(_smoothDir, camera.up).normalize();
      if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);

      const showTrail = phase === 'dash' || phase === 'ascend' || phase === 'dive';
      for (let i = 0; i < ghosts.length; i++) {
        const ghost = ghosts[i];
        const t = (i + 1) / (ghosts.length + 0.5);
        sampleHistory(t * 0.8, _ghostPos);
        ghost.visible = showTrail && historyCount > 2;
        if (!ghost.visible) continue;

        ghost.position.copy(_ghostPos).addScaledVector(_smoothDir, -t * 1.2);
        billboard(ghost, camera);
        const s = topGroup.scale.x * (0.9 - t * 0.12);
        ghost.scale.set(s, s, s);
        ghost.material.color.setHex(style.tint);
        ghost.material.opacity = Math.max(0.03, (0.32 - t * 0.26) * intensity);
      }

      const streakLen = 0.7 + speedFactor * 2.0 * style.ribbon;
      const yaw = Math.atan2(_smoothDir.x, _smoothDir.z);
      const pitch = -Math.asin(Math.max(-1, Math.min(1, _smoothDir.y)));

      for (let i = 0; i < streaks.length; i++) {
        const streak = streaks[i];
        const t = i / Math.max(1, streaks.length - 1);
        const show = showTrail && (smoothSpeed > 0.8 || phase !== 'dash');
        streak.visible = show;
        if (!show) continue;

        const back = 0.3 + t * 2.8;
        const fan = (i - (streaks.length - 1) * 0.5) * 0.09;
        streak.position.copy(_pos);
        streak.position.addScaledVector(_smoothDir, -back);
        streak.position.addScaledVector(_right, fan);
        streak.rotation.order = 'YXZ';
        streak.rotation.y = yaw;
        streak.rotation.x = pitch * 0.65;
        streak.rotation.z = fan * 0.3;
        streak.scale.set(1, streakLen * (1 - t * 0.32), 1);
        streak.material.color.setHex(style.tint);
        streak.material.opacity = Math.max(0.04, (0.48 - t * 0.4) * intensity);
      }

      const ribbonShow = showTrail && (smoothSpeed > 1.2 || phase === 'ascend' || phase === 'dive');
      ribbon.visible = ribbonShow;
      if (ribbonShow) {
        ribbon.position.copy(_pos).addScaledVector(_smoothDir, -1.0);
        ribbon.scale.set(0.7 + speedFactor * 0.45, 1.0 + speedFactor * 1.4 * style.ribbon, 1);
        ribbon.material.color.setHex(style.tint);
        ribbon.material.opacity = 0.1 + speedFactor * 0.16 * intensity;
        billboard(ribbon, camera);
      }

      core.visible = showTrail;
      if (showTrail) {
        core.position.copy(_pos);
        billboard(core, camera);
        core.scale.setScalar(topGroup.scale.x * (0.48 + speedFactor * 0.28));
        core.material.color.setHex(WHITE);
        core.material.opacity = 0.12 + speedFactor * 0.28 * intensity;
      }

      // Apex 4-ray star — visible near the top of ascend, fades as dive begins.
      const apexFrac = lift / 38;
      const showStar = (phase === 'ascend' && apexFrac > 0.55) || (phase === 'dive' && apexFrac > 0.7);
      apexStar.visible = showStar;
      if (showStar) {
        apexStar.position.copy(_pos);
        apexStar.position.y += 1.2;
        billboard(apexStar, camera);
        const starLife = phase === 'ascend'
          ? clamp01((apexFrac - 0.55) / 0.45)
          : clamp01((apexFrac - 0.7) / 0.3);
        const spin = performance.now() * 0.0008;
        apexStar.rotation.z = spin;
        apexStar.scale.setScalar(1.1 + starLife * 0.55);
        apexStar.material.opacity = 0.55 * starLife * (phase === 'dive' ? 0.7 : 1);
      }

      if (body.userData.starImpactFlash || impactT > 0) {
        if (body.userData.starImpactFlash && impactT < 0.1) impactT = 0.22;
        impactT = Math.max(0, impactT - dt);
        const fade = clamp01(impactT / 0.22);
        impactRing.visible = fade > 0.02;
        impactRing.position.set(_pos.x, body.position.y + 0.06, _pos.z);
        impactRing.scale.setScalar(1.2 + (1 - fade) * 2.2);
        impactRing.material.opacity = 0.45 * fade;
      } else {
        impactRing.visible = false;
        impactRing.material.opacity = 0;
      }
    },
    reset,
  };
}
