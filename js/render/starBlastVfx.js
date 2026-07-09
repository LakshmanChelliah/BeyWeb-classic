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

/** Bold 4-ray star texture for Star Blast apex (canon Shooting Star). */
function createFourRayStarTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 256, 256);
  const cx = 128;
  const cy = 128;

  // Soft glow behind the star
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 90);
  glow.addColorStop(0, 'rgba(224,242,254,0.85)');
  glow.addColorStop(0.35, 'rgba(125,211,252,0.45)');
  glow.addColorStop(1, 'rgba(96,165,250,0)');
  ctx.fillStyle = glow;
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
    // Secondary thinner ray
    ctx.fillStyle = 'rgba(186,230,253,0.75)';
    ctx.beginPath();
    ctx.moveTo(0, -95);
    ctx.lineTo(4, -14);
    ctx.lineTo(0, 0);
    ctx.lineTo(-4, -14);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.98)';
    ctx.restore();
  }

  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(0.4, 'rgba(186,230,253,0.75)');
  core.addColorStop(1, 'rgba(96,165,250,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dense speed lines, afterimages, apex 4-ray star, and dive ribbon for Star Blast. */
export function createStarBlastVfx(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const ghosts = [];
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 2.3),
      makeTrailMat(BLUE_LIGHT, 0.42 - i * 0.055)
    );
    mesh.visible = false;
    mesh.renderOrder = 4;
    root.add(mesh);
    ghosts.push(mesh);
  }

  const streaks = [];
  for (let i = 0; i < 14; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.055, 2.4),
      makeTrailMat(BLUE_PALE, 0.6 - i * 0.035)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    streaks.push(mesh);
  }

  const ribbon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 4.0),
    makeTrailMat(BLUE, 0.32)
  );
  ribbon.visible = false;
  ribbon.renderOrder = 3;
  root.add(ribbon);

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(1.8, 1.8),
    makeTrailMat(WHITE, 0.5)
  );
  core.visible = false;
  core.renderOrder = 6;
  root.add(core);

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

  const starHalo = new THREE.Mesh(
    new THREE.PlaneGeometry(7.5, 7.5),
    makeTrailMat(BLUE_LIGHT, 0)
  );
  starHalo.visible = false;
  starHalo.renderOrder = 7;
  root.add(starHalo);

  const impactRing = new THREE.Mesh(
    new THREE.RingGeometry(0.45, 0.95, 48),
    makeTrailMat(WHITE, 0)
  );
  impactRing.rotation.x = -Math.PI / 2;
  impactRing.visible = false;
  impactRing.renderOrder = 7;
  root.add(impactRing);

  const impactBurst = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 2.4),
    makeTrailMat(WHITE, 0)
  );
  impactBurst.visible = false;
  impactBurst.renderOrder = 8;
  root.add(impactBurst);

  const history = Array.from({ length: HISTORY_LEN }, () => new THREE.Vector3());
  let historyCount = 0;
  let hasLast = false;
  let smoothSpeed = 0;
  let impactT = 0;
  let lastPhase = null;

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
    if (phase === 'ascend') return { tint: BLUE_LIGHT, intensity: 1.25, ribbon: 1.4 };
    if (phase === 'dive') return { tint: BLUE_PALE, intensity: 1.55, ribbon: 1.7 };
    if (phase === 'bounce') return { tint: WHITE, intensity: 0.9, ribbon: 0.7 };
    return { tint: BLUE, intensity: 1.1, ribbon: 1.05 };
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
    starHalo.visible = false;
    starHalo.material.opacity = 0;
    impactRing.visible = false;
    impactRing.material.opacity = 0;
    impactBurst.visible = false;
    impactBurst.material.opacity = 0;
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
          impactT = 0.32;
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
        _vel.lerp(_hint, phase === 'dash' ? 0.65 : 0.82);
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
      const intensity = style.intensity * (0.6 + speedFactor * 0.55 + Math.min(lift, 38) / 38 * 0.25);

      _right.crossVectors(_smoothDir, camera.up).normalize();
      if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);

      const showTrail = phase === 'dash' || phase === 'ascend' || phase === 'dive';
      for (let i = 0; i < ghosts.length; i++) {
        const ghost = ghosts[i];
        const t = (i + 1) / (ghosts.length + 0.5);
        sampleHistory(t * 0.88, _ghostPos);
        ghost.visible = showTrail && historyCount > 2;
        if (!ghost.visible) continue;

        ghost.position.copy(_ghostPos).addScaledVector(_smoothDir, -t * 1.55);
        billboard(ghost, camera);
        const s = topGroup.scale.x * (0.98 - t * 0.15);
        ghost.scale.set(s, s, s);
        ghost.material.color.setHex(style.tint);
        ghost.material.opacity = Math.max(0.05, (0.48 - t * 0.38) * intensity);
      }

      const streakLen = 1.0 + speedFactor * 2.8 * style.ribbon;
      const yaw = Math.atan2(_smoothDir.x, _smoothDir.z);
      const pitch = -Math.asin(Math.max(-1, Math.min(1, _smoothDir.y)));

      for (let i = 0; i < streaks.length; i++) {
        const streak = streaks[i];
        const t = i / Math.max(1, streaks.length - 1);
        const show = showTrail && (smoothSpeed > 0.6 || phase !== 'dash');
        streak.visible = show;
        if (!show) continue;

        const back = 0.35 + t * 3.6;
        const fan = (i - (streaks.length - 1) * 0.5) * 0.12;
        streak.position.copy(_pos);
        streak.position.addScaledVector(_smoothDir, -back);
        streak.position.addScaledVector(_right, fan);
        streak.rotation.order = 'YXZ';
        streak.rotation.y = yaw;
        streak.rotation.x = pitch * 0.7;
        streak.rotation.z = fan * 0.4;
        streak.scale.set(1, streakLen * (1 - t * 0.35), 1);
        streak.material.color.setHex(style.tint);
        streak.material.opacity = Math.max(0.06, (0.65 - t * 0.52) * intensity);
      }

      const ribbonShow = showTrail && (smoothSpeed > 1.0 || phase === 'ascend' || phase === 'dive');
      ribbon.visible = ribbonShow;
      if (ribbonShow) {
        ribbon.position.copy(_pos).addScaledVector(_smoothDir, -1.25);
        ribbon.scale.set(0.95 + speedFactor * 0.7, 1.3 + speedFactor * 2.0 * style.ribbon, 1);
        ribbon.material.color.setHex(style.tint);
        ribbon.material.opacity = 0.18 + speedFactor * 0.28 * intensity;
        billboard(ribbon, camera);
      }

      core.visible = showTrail;
      if (showTrail) {
        core.position.copy(_pos);
        billboard(core, camera);
        core.scale.setScalar(topGroup.scale.x * (0.65 + speedFactor * 0.45));
        core.material.color.setHex(WHITE);
        core.material.opacity = 0.22 + speedFactor * 0.42 * intensity;
      }

      // Apex 4-ray star — big and bright near the top of ascend / start of dive.
      const apexFrac = lift / 38;
      const showStar = (phase === 'ascend' && apexFrac > 0.4) || (phase === 'dive' && apexFrac > 0.55);
      apexStar.visible = showStar;
      starHalo.visible = showStar;
      if (showStar) {
        apexStar.position.copy(_pos);
        apexStar.position.y += 1.6;
        starHalo.position.copy(apexStar.position);
        billboard(apexStar, camera);
        billboard(starHalo, camera);
        const starLife = phase === 'ascend'
          ? clamp01((apexFrac - 0.4) / 0.6)
          : clamp01((apexFrac - 0.55) / 0.45);
        const spin = performance.now() * 0.0012;
        apexStar.rotation.z = spin;
        starHalo.rotation.z = -spin * 0.6;
        apexStar.scale.setScalar(1.4 + starLife * 0.9);
        starHalo.scale.setScalar(1.2 + starLife * 0.7);
        apexStar.material.opacity = 0.85 * starLife * (phase === 'dive' ? 0.8 : 1);
        starHalo.material.opacity = 0.28 * starLife;
      }

      if (body.userData.starImpactFlash || impactT > 0) {
        if (body.userData.starImpactFlash && impactT < 0.12) impactT = 0.32;
        impactT = Math.max(0, impactT - dt);
        const fade = clamp01(impactT / 0.32);
        impactRing.visible = fade > 0.02;
        impactBurst.visible = fade > 0.02;
        impactRing.position.set(_pos.x, body.position.y + 0.06, _pos.z);
        impactRing.scale.setScalar(1.4 + (1 - fade) * 3.2);
        impactRing.material.opacity = 0.65 * fade;
        impactBurst.position.copy(_pos);
        billboard(impactBurst, camera);
        impactBurst.scale.setScalar(1.2 + (1 - fade) * 1.8);
        impactBurst.material.opacity = 0.55 * fade;
      } else {
        impactRing.visible = false;
        impactRing.material.opacity = 0;
        impactBurst.visible = false;
        impactBurst.material.opacity = 0;
      }
    },
    reset,
  };
}
