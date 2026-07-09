/**
 * Storm Pegasus — Speed Boost VFX.
 * Dense blue trail particles; activation is a particle burst (no burst ring).
 */
import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
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

const BLUE_CORE = 0x60a5fa;
const BLUE_LIGHT = 0x7dd3fc;
const BLUE_PALE = 0xbae6fd;
const BLUE_WHITE = 0xe0f2fe;

const HISTORY_LEN = 14;

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

export function createPegasusSpeedBoostVfx(scene) {
  ensureQuarksRuntime(scene);
  const root = new THREE.Group();
  scene.add(root);

  const ghosts = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.45, 1.45),
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
      new THREE.PlaneGeometry(0.04, 1.6),
      makeTrailMat(BLUE_PALE, 0.48 - i * 0.04)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    streaks.push(mesh);
  }

  const core = new THREE.Mesh(
    new THREE.PlaneGeometry(1.15, 1.15),
    makeTrailMat(BLUE_WHITE, 0)
  );
  core.renderOrder = 7;
  root.add(core);

  const trail = createTrailSystem(scene, {
    rate: 55,
    startSize: [0.15, 0.45],
    startLife: [0.15, 0.35],
    colorA: new Vector4(0.4, 0.7, 1, 0.9),
    colorB: new Vector4(0.8, 0.95, 1, 0),
  });

  const activateBurst = createBurstSystem(scene, {
    additive: true,
    startSpeed: [5, 14],
    startSize: [0.1, 0.4],
    gravity: -2,
    colorA: new Vector4(0.55, 0.8, 1, 1),
    colorB: new Vector4(0.9, 0.97, 1, 0),
  });

  const history = Array.from({ length: HISTORY_LEN }, () => new THREE.Vector3());
  let historyCount = 0;
  let hasLast = false;
  let smoothSpeed = 0;
  let wasBoosting = false;

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
    core.visible = false;
    core.material.opacity = 0;
    trail.stop();
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
    target.lerpVectors(history[i0], history[i1], f - i0);
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

      const boosting = !!body.userData.boosting;
      if (!boosting) {
        reset();
        return;
      }

      root.visible = true;
      topGroup.getWorldPosition(_pos);

      if (!wasBoosting) {
        activateBurst.setPosition(_pos.x, _pos.y, _pos.z);
        activateBurst.burst(32);
        wasBoosting = true;
      }

      if (hasLast) {
        _vel.subVectors(_pos, _lastPos).divideScalar(Math.max(dt, 0.001));
      } else {
        _vel.set(0, 0, 0);
        hasLast = true;
      }
      _lastPos.copy(_pos);

      const blend = 1 - Math.exp(-14 * dt);
      _smoothVel.lerp(_vel, blend);
      smoothSpeed += (_smoothVel.length() - smoothSpeed) * blend;
      if (_smoothVel.lengthSq() > 0.2) {
        _dir.copy(_smoothVel).normalize();
        _smoothDir.lerp(_dir, blend);
        if (_smoothDir.lengthSq() > 1e-6) _smoothDir.normalize();
      }

      for (let i = Math.min(historyCount, HISTORY_LEN - 1); i > 0; i--) {
        history[i].copy(history[i - 1]);
      }
      history[0].copy(_pos);
      historyCount = Math.min(historyCount + 1, HISTORY_LEN);

      const speedFactor = clamp01(smoothSpeed / 22);
      _right.crossVectors(_smoothDir, camera.up).normalize();
      if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);

      for (let i = 0; i < ghosts.length; i++) {
        const ghost = ghosts[i];
        const t = (i + 1) / (ghosts.length + 0.5);
        sampleHistory(t * 0.75, _ghostPos);
        ghost.visible = historyCount > 2;
        if (!ghost.visible) continue;
        ghost.position.copy(_ghostPos).addScaledVector(_smoothDir, -t * 0.9);
        billboard(ghost, camera);
        ghost.scale.setScalar(topGroup.scale.x * (0.85 - t * 0.1));
        ghost.material.opacity = Math.max(0.04, (0.3 - t * 0.22) * (0.6 + speedFactor));
      }

      const yaw = Math.atan2(_smoothDir.x, _smoothDir.z);
      for (let i = 0; i < streaks.length; i++) {
        const streak = streaks[i];
        const t = i / Math.max(1, streaks.length - 1);
        streak.visible = smoothSpeed > 1;
        if (!streak.visible) continue;
        const fan = (i - (streaks.length - 1) * 0.5) * 0.08;
        streak.position.copy(_pos).addScaledVector(_smoothDir, -(0.25 + t * 2.2));
        streak.position.addScaledVector(_right, fan);
        streak.rotation.order = 'YXZ';
        streak.rotation.y = yaw;
        streak.scale.set(1, 0.8 + speedFactor * 1.6 * (1 - t * 0.3), 1);
        streak.material.opacity = Math.max(0.04, (0.45 - t * 0.35) * (0.5 + speedFactor));
      }

      core.visible = true;
      core.position.copy(_pos);
      billboard(core, camera);
      core.scale.setScalar(topGroup.scale.x * (0.5 + speedFactor * 0.25));
      core.material.opacity = 0.15 + speedFactor * 0.3;

      trail.follow(_pos.x, _pos.y, _pos.z, smoothSpeed > 0.5);
    },
    reset,
  };
}
