import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';

const _pos = new THREE.Vector3();
const _lastPos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _smoothVel = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _smoothDir = new THREE.Vector3();
const _right = new THREE.Vector3();
const _ghostPos = new THREE.Vector3();

const BLUE_CORE = 0x60a5fa;
const BLUE_LIGHT = 0x7dd3fc;
const BLUE_PALE = 0xbae6fd;
const BLUE_WHITE = 0xe0f2fe;

const BOOST_DUR = 3;
const HISTORY_LEN = 12;

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

/** Tight blue afterimages and speed lines for Storm Pegasus Speed Boost only. */
export function createPegasusSpeedBoostVfx(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const ghosts = [];
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 1.35),
      makeTrailMat(BLUE_LIGHT, 0.28 - i * 0.07)
    );
    mesh.visible = false;
    mesh.renderOrder = 4;
    root.add(mesh);
    ghosts.push(mesh);
  }

  const streaks = [];
  for (let i = 0; i < 7; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.035, 1.45),
      makeTrailMat(BLUE_PALE, 0.42 - i * 0.045)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    streaks.push(mesh);
  }

  const sparks = [];
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 0.1),
      makeTrailMat(BLUE_WHITE, 0)
    );
    mesh.renderOrder = 6;
    root.add(mesh);
    sparks.push({ mesh, phase: (i / 5) * Math.PI * 2 });
  }

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(1.05, 1.05),
    makeTrailMat(BLUE_WHITE, 0)
  );
  core.renderOrder = 7;
  root.add(core);

  const burstRing = new THREE.Mesh(
    new THREE.RingGeometry(0.88, 1.02, 36),
    makeTrailMat(BLUE_CORE, 0)
  );
  burstRing.rotation.x = -Math.PI / 2;
  burstRing.renderOrder = 3;
  root.add(burstRing);

  const history = Array.from({ length: HISTORY_LEN }, () => new THREE.Vector3());
  let historyCount = 0;
  let hasLast = false;
  let smoothSpeed = 0;
  let wasBoosting = false;

  function billboard(mesh, camera) {
    mesh.quaternion.copy(camera.quaternion);
  }

  function reset() {
    root.visible = false;
    historyCount = 0;
    hasLast = false;
    smoothSpeed = 0;
    wasBoosting = false;
    _smoothVel.set(0, 0, 0);
    _smoothDir.set(0, 0, -1);
    for (const g of ghosts) g.visible = false;
    for (const s of streaks) s.visible = false;
    for (const sp of sparks) sp.mesh.material.opacity = 0;
    core.material.opacity = 0;
    burstRing.material.opacity = 0;
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

  reset();

  return {
    update(topGroup, body, camera, dt) {
      if (!topGroup || !body || !camera) {
        reset();
        return;
      }

      // Pegasus-only — Striker Blitz uses strikerBlitzing + striker VFX.
      const boosting = !!body.userData.boosting && !body.userData.strikerBlitzing;
      if (!boosting) {
        reset();
        return;
      }

      if (!wasBoosting) {
        body.userData.boostT = body.userData.boostT ?? 0;
        historyCount = 0;
        hasLast = false;
      }
      wasBoosting = true;
      body.userData.boostT = (body.userData.boostT ?? 0) + dt;

      root.visible = true;
      topGroup.getWorldPosition(_pos);

      if (hasLast) {
        _vel.subVectors(_pos, _lastPos).divideScalar(Math.max(dt, 0.001));
      } else {
        _vel.set(body.velocity.x, 0, body.velocity.z);
        hasLast = true;
      }
      _lastPos.copy(_pos);

      const blend = 1 - Math.exp(-14 * dt);
      _smoothVel.lerp(_vel, blend);
      smoothSpeed += (_smoothVel.length() - smoothSpeed) * blend;

      if (_smoothVel.lengthSq() > 0.2) {
        _dir.copy(_smoothVel).normalize();
      } else if (body.velocity) {
        const vx = body.velocity.x;
        const vz = body.velocity.z;
        const len = Math.hypot(vx, vz);
        if (len > 0.15) _dir.set(vx / len, 0, vz / len);
      }
      _smoothDir.lerp(_dir, blend);
      if (_smoothDir.lengthSq() > 1e-6) _smoothDir.normalize();

      for (let i = Math.min(historyCount, HISTORY_LEN - 1); i > 0; i--) {
        history[i].copy(history[i - 1]);
      }
      history[0].copy(_pos);
      historyCount = Math.min(historyCount + 1, HISTORY_LEN);

      const boostT = body.userData.boostT ?? 0;
      const life = clamp01(1 - boostT / BOOST_DUR);
      const speedFactor = clamp01(smoothSpeed / 18);
      const intensity = (0.45 + speedFactor * 0.45) * (0.4 + life * 0.6);

      if (boostT < 0.28) {
        const t = boostT / 0.28;
        const e = 1 - (1 - t) * (1 - t);
        const R = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
        burstRing.position.copy(_pos);
        burstRing.position.y = body.position.y + (body.userData.visualYOffset ?? 0) * 0.5;
        burstRing.scale.setScalar(R * (1 + e * 1.6));
        burstRing.material.opacity = 0.32 * (1 - t);
      } else {
        burstRing.material.opacity = 0;
      }

      _right.crossVectors(_smoothDir, camera.up).normalize();
      if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);

      for (let i = 0; i < ghosts.length; i++) {
        const ghost = ghosts[i];
        const t = (i + 1) / (ghosts.length + 0.5);
        sampleHistory(t * 0.7, _ghostPos);
        ghost.visible = historyCount > 2 && speedFactor > 0.1;
        if (!ghost.visible) continue;

        ghost.position.copy(_ghostPos).addScaledVector(_smoothDir, -t * 0.95);
        billboard(ghost, camera);
        const s = topGroup.scale.x * (0.88 - t * 0.12);
        ghost.scale.set(s, s, s);
        ghost.material.opacity = Math.max(0.03, (0.28 - t * 0.22) * intensity);
      }

      const streakLen = 0.55 + speedFactor * 1.7;
      const yaw = Math.atan2(_smoothDir.x, _smoothDir.z);
      const showStreaks = smoothSpeed > 0.8 || speedFactor > 0.08;

      for (let i = 0; i < streaks.length; i++) {
        const streak = streaks[i];
        const t = i / Math.max(1, streaks.length - 1);
        streak.visible = showStreaks;
        if (!showStreaks) continue;

        const back = 0.28 + t * 2.1;
        const fan = (i - (streaks.length - 1) * 0.5) * 0.07;
        streak.position.copy(_pos);
        streak.position.addScaledVector(_smoothDir, -back);
        streak.position.addScaledVector(_right, fan);
        streak.rotation.order = 'YXZ';
        streak.rotation.y = yaw;
        streak.rotation.z = fan * 0.25;
        streak.scale.set(1, streakLen * (1 - t * 0.3), 1);
        streak.material.opacity = Math.max(0.04, (0.4 - t * 0.32) * intensity);
      }

      const R = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
      const yBase = body.position.y + (body.userData.visualYOffset ?? 0)
        + (body.userData.flightLift ?? 0);
      const orbitRate = 3.5 + speedFactor * 5;

      for (const sp of sparks) {
        sp.phase += dt * orbitRate;
        const orbitR = R * (1.08 + 0.08 * Math.sin(sp.phase * 2));
        const lift = 0.12 + Math.sin(sp.phase * 1.4) * 0.08;
        sp.mesh.position.set(
          _pos.x + Math.cos(sp.phase) * orbitR,
          yBase + lift,
          _pos.z + Math.sin(sp.phase) * orbitR
        );
        billboard(sp.mesh, camera);
        sp.mesh.material.opacity = (0.14 + speedFactor * 0.18) * life;
        sp.mesh.scale.setScalar(0.55 + speedFactor * 0.35);
      }

      core.position.copy(_pos);
      core.position.y = yBase;
      billboard(core, camera);
      core.scale.setScalar(topGroup.scale.x * (0.38 + speedFactor * 0.18));
      core.material.opacity = (0.08 + speedFactor * 0.14) * life;
    },
    reset,
  };
}
