/**
 * Ray Striker - Blitz Charge + Lightning Sword Flash VFX.
 * Canon Flash (紫電の一閃): purple lightning pierce; anime vanish as green light rays.
 * Blitz Charge keeps teal speed trails. No vanish rings.
 */
import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';
import { STRIKER_VANISH_DUR } from '../game/abilities.js';
import {
  createBurstSystem,
  createTrailSystem,
  ensureQuarksRuntime,
  Vector4,
} from './vfx/quarksRuntime.js';
import { createGreenRayBurst, createSparkBurst } from './vfx/presets.js';

const TEAL = 0x14b8a6;
const TEAL_LIGHT = 0x2dd4bf;
const TEAL_PALE = 0x5eead4;
const TEAL_WHITE = 0xccfbf1;

const PURPLE = 0xa855f7;
const PURPLE_LIGHT = 0xc084fc;
const PURPLE_PALE = 0xe9d5ff;
const PURPLE_HOT = 0xfaf5ff;

const GREEN = 0x4ade80;
const GREEN_LIGHT = 0x86efac;
const GREEN_PALE = 0xdcfce7;

const _pos = new THREE.Vector3();
const _lastPos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _smoothVel = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _smoothDir = new THREE.Vector3();
const _right = new THREE.Vector3();

const BLITZ_DUR = 3;
const HISTORY_LEN = 10;

function makeMat(color, opacity, additive = true) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

export function createStrikerAbilityVfx(scene) {
  ensureQuarksRuntime(scene);
  const root = new THREE.Group();
  scene.add(root);

  const blitzTrail = createTrailSystem(scene, {
    rate: 75,
    startSize: [0.15, 0.5],
    startLife: [0.18, 0.4],
    colorA: new Vector4(0.2, 0.95, 0.85, 0.95),
    colorB: new Vector4(0.75, 1, 0.95, 0),
  });
  const purpleFlashBurst = createSparkBurst(scene, { tint: 'purple' });
  const greenVanishBurst = createGreenRayBurst(scene);
  const bounceDust = createBurstSystem(scene, {
    additive: false,
    dustyColor: 0xc084fc,
    startSpeed: [4, 12],
    startSize: [0.15, 0.55],
    gravity: -12,
    colorA: new Vector4(0.7, 0.45, 0.95, 0.9),
    colorB: new Vector4(0.35, 0.15, 0.55, 0),
  });

  const blitzGroup = new THREE.Group();
  const vanishGroup = new THREE.Group();
  const dashGroup = new THREE.Group();
  root.add(blitzGroup);
  root.add(vanishGroup);
  root.add(dashGroup);

  // --- Blitz Charge (teal) ---
  const blitzStreaks = [];
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.035, 1.35),
      makeMat(TEAL_PALE, 0)
    );
    mesh.renderOrder = 5;
    blitzGroup.add(mesh);
    blitzStreaks.push(mesh);
  }

  const blitzSparks = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 0.09),
      makeMat(TEAL_WHITE, 0)
    );
    mesh.renderOrder = 6;
    blitzGroup.add(mesh);
    blitzSparks.push({ mesh, phase: (i / 4) * Math.PI * 2 });
  }

  const blitzCore = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    makeMat(TEAL_WHITE, 0)
  );
  blitzCore.renderOrder = 7;
  blitzGroup.add(blitzCore);

  // --- Lightning Sword Flash - green vanish rays ---
  const vanishCore = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 1.25),
    makeMat(GREEN_PALE, 0)
  );
  vanishCore.renderOrder = 9;
  vanishGroup.add(vanishCore);

  const vanishStreaks = [];
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.045, 1.85),
      makeMat(i % 2 === 0 ? GREEN_LIGHT : GREEN, 0)
    );
    mesh.renderOrder = 7;
    vanishGroup.add(mesh);
    vanishStreaks.push({ mesh, angle: (i / 10) * Math.PI * 2 });
  }

  const afterimage = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    makeMat(GREEN, 0, false)
  );
  afterimage.renderOrder = 4;
  vanishGroup.add(afterimage);

  // Reappear / pierce - purple lightning sword motif.
  const reappearBurst = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    makeMat(PURPLE_HOT, 0)
  );
  reappearBurst.renderOrder = 10;
  dashGroup.add(reappearBurst);

  // Sword-motif dash streaks - purple lightning blades.
  const dashStreaks = [];
  for (let i = 0; i < 7; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.055, 2.35),
      makeMat(i % 2 === 0 ? PURPLE_HOT : PURPLE_LIGHT, 0)
    );
    mesh.renderOrder = 6;
    dashGroup.add(mesh);
    dashStreaks.push({ mesh, offset: i / 7 });
  }

  // Central pierce beam during dash (single-point purple lightning).
  const pierceBeam = new THREE.Mesh(
    new THREE.PlaneGeometry(0.22, 3.4),
    makeMat(PURPLE_PALE, 0)
  );
  pierceBeam.renderOrder = 8;
  dashGroup.add(pierceBeam);

  const history = Array.from({ length: HISTORY_LEN }, () => new THREE.Vector3());
  let historyCount = 0;
  let hasLast = false;
  let smoothSpeed = 0;
  let dashSpin = 0;
  let wasBlitz = false;

  function billboard(mesh, camera) {
    mesh.quaternion.copy(camera.quaternion);
  }

  function setOpacity(mesh, opacity) {
    const show = opacity > 0.02;
    mesh.visible = show;
    mesh.material.opacity = show ? opacity : 0;
  }

  let lastBouncePulse = -1;
  let didVanishBurst = false;
  let didReappearBurst = false;

  function hideBlitz() {
    for (const s of blitzStreaks) setOpacity(s, 0);
    for (const sp of blitzSparks) setOpacity(sp.mesh, 0);
    setOpacity(blitzCore, 0);
    blitzTrail.stop();
  }

  function hideFlash() {
    setOpacity(vanishCore, 0);
    setOpacity(afterimage, 0);
    setOpacity(reappearBurst, 0);
    setOpacity(pierceBeam, 0);
    for (const s of vanishStreaks) setOpacity(s.mesh, 0);
    for (const s of dashStreaks) setOpacity(s.mesh, 0);
  }

  function reset() {
    root.visible = false;
    historyCount = 0;
    hasLast = false;
    smoothSpeed = 0;
    dashSpin = 0;
    wasBlitz = false;
    lastBouncePulse = -1;
    didVanishBurst = false;
    didReappearBurst = false;
    _smoothVel.set(0, 0, 0);
    _smoothDir.set(0, 0, -1);
    hideBlitz();
    hideFlash();
  }

  reset();

  return {
    update(topGroup, body, camera, dt) {
      if (!body || !camera) {
        reset();
        return;
      }

      const blitzing = !!body.userData.strikerBlitzing;
      const phase = body.userData.strikerFlashPhase;
      const vanish = body.userData.topVanish ?? 0;
      const reappear = body.userData.strikerReappearFlash ?? 0;
      const inDash = phase === 'dash' && body.userData.strikerSlamming;
      const vanishing = phase === 'vanish' || vanish > 0.02;
      const reappearing = phase === 'reappear' || reappear > 0.02;
      const inFlash = vanishing || reappearing || inDash;
      const isStrikerVictim =
        body.userData.launchBounceSource === 'striker' &&
        body.userData.launchBouncePhase != null;

      if (!blitzing && !inFlash && !isStrikerVictim) {
        reset();
        return;
      }

      if (isStrikerVictim && body.userData.launchBouncePhase === 'bounce') {
        topGroup?.getWorldPosition(_pos);
        const pulse = body.userData.launchBouncePulseT ?? 0;
        if (pulse < 0.05 && lastBouncePulse > 0.1) {
          bounceDust.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.12, _pos.z);
          bounceDust.burst(14);
        }
        lastBouncePulse = pulse;
        if (!blitzing && !inFlash) {
          root.visible = true;
          return;
        }
      }

      root.visible = true;
      const floorY = CONFIG.FLOOR_Y + 0.03;
      const R = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;

      if (blitzing && topGroup) {
        if (!wasBlitz) {
          historyCount = 0;
          hasLast = false;
        }
        wasBlitz = true;
        hideFlash();

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
          const len = Math.hypot(body.velocity.x, body.velocity.z);
          if (len > 0.15) _dir.set(body.velocity.x / len, 0, body.velocity.z / len);
        }
        _smoothDir.lerp(_dir, blend);
        if (_smoothDir.lengthSq() > 1e-6) _smoothDir.normalize();
        _right.crossVectors(_smoothDir, camera.up).normalize();
        if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);

        for (let i = Math.min(historyCount, HISTORY_LEN - 1); i > 0; i--) {
          history[i].copy(history[i - 1]);
        }
        history[0].copy(_pos);
        historyCount = Math.min(historyCount + 1, HISTORY_LEN);

        const boostT = body.userData.boostT ?? 0;
        const life = clamp01(1 - boostT / BLITZ_DUR);
        const speedFactor = clamp01(smoothSpeed / 18);
        const intensity = (0.45 + speedFactor * 0.4) * (0.4 + life * 0.6);
        const yBase = body.position.y + (body.userData.visualYOffset ?? 0) * 0.4;

        if (boostT < 0.08 && !didVanishBurst) {
          purpleFlashBurst.setPosition(_pos.x, yBase, _pos.z);
          purpleFlashBurst.burst(18);
          didVanishBurst = true;
        }
        blitzTrail.follow(_pos.x, yBase, _pos.z, speedFactor > 0.08);

        const yaw = Math.atan2(_smoothDir.x, _smoothDir.z);
        const streakLen = 0.5 + speedFactor * 1.6;
        const showStreaks = speedFactor > 0.08;
        for (let i = 0; i < blitzStreaks.length; i++) {
          const streak = blitzStreaks[i];
          const t = i / Math.max(1, blitzStreaks.length - 1);
          if (!showStreaks) {
            setOpacity(streak, 0);
            continue;
          }
          const back = 0.25 + t * 1.9;
          const fan = (i - (blitzStreaks.length - 1) * 0.5) * 0.065;
          streak.position.copy(_pos);
          streak.position.addScaledVector(_smoothDir, -back);
          streak.position.addScaledVector(_right, fan);
          streak.position.y = yBase + 0.02;
          streak.rotation.set(0, yaw, fan * 0.2);
          streak.scale.set(1, streakLen * (1 - t * 0.28), 1);
          setOpacity(streak, Math.max(0.04, (0.36 - t * 0.28) * intensity));
        }

        for (const sp of blitzSparks) {
          sp.phase += dt * (3.2 + speedFactor * 4);
          const orbitR = R * (1.05 + 0.06 * Math.sin(sp.phase * 2));
          sp.mesh.position.set(
            _pos.x + Math.cos(sp.phase) * orbitR,
            yBase + 0.1 + Math.sin(sp.phase * 1.5) * 0.06,
            _pos.z + Math.sin(sp.phase) * orbitR
          );
          billboard(sp.mesh, camera);
          setOpacity(sp.mesh, (0.12 + speedFactor * 0.16) * life);
        }

        blitzCore.position.copy(_pos);
        blitzCore.position.y = yBase;
        billboard(blitzCore, camera);
        blitzCore.scale.setScalar((topGroup?.scale?.x ?? 1) * (0.35 + speedFactor * 0.15));
        setOpacity(blitzCore, (0.06 + speedFactor * 0.12) * life);
        return;
      }

      hideBlitz();
      wasBlitz = false;

      if (vanishing && phase === 'vanish') {
        dashGroup.position.set(body.position.x, floorY, body.position.z);
        const vx = body.userData.strikerVanishX ?? body.position.x;
        const vz = body.userData.strikerVanishZ ?? body.position.z;
        vanishGroup.position.set(vx, floorY, vz);
        const t = clamp01((body.userData.strikerFlashPhaseT ?? 0) / STRIKER_VANISH_DUR);
        const burst = 1 - t;

        if (!didVanishBurst) {
          greenVanishBurst.setPosition(vx, floorY + R * 0.3, vz);
          greenVanishBurst.burst(48);
          didVanishBurst = true;
          didReappearBurst = false;
        }

        vanishCore.position.set(0, R * 0.42, 0);
        billboard(vanishCore, camera);
        vanishCore.scale.setScalar(R * (1.05 - t * 0.5));
        setOpacity(vanishCore, burst * 0.75);

        afterimage.position.set(0, R * 0.4, 0);
        billboard(afterimage, camera);
        afterimage.scale.setScalar(R * 0.95);
        setOpacity(afterimage, (1 - t) * 0.35);

        // Green light rays shooting outward (anime teleport motif).
        for (const s of vanishStreaks) {
          const len = R * (1.15 + t * 2.6);
          s.mesh.position.set(
            Math.cos(s.angle) * len * 0.5,
            R * 0.35 + Math.sin(s.angle * 2) * 0.08,
            Math.sin(s.angle) * len * 0.5
          );
          s.mesh.rotation.y = s.angle;
          billboard(s.mesh, camera);
          s.mesh.scale.set(1, 1.1 + burst * 0.6, 1);
          setOpacity(s.mesh, burst * 0.5 * (0.7 + 0.3 * Math.sin(s.angle * 3)));
        }

        setOpacity(reappearBurst, 0);
        setOpacity(pierceBeam, 0);
        for (const s of dashStreaks) setOpacity(s.mesh, 0);
        return;
      }

      vanishGroup.position.set(
        body.userData.strikerVanishX ?? body.position.x,
        floorY,
        body.userData.strikerVanishZ ?? body.position.z
      );
      setOpacity(vanishCore, 0);
      setOpacity(afterimage, 0);
      for (const s of vanishStreaks) setOpacity(s.mesh, 0);

      dashGroup.position.set(body.position.x, floorY, body.position.z);
      dashSpin += dt * 8;

      if (reappearing) {
        const flash = phase === 'reappear' ? reappear : 0;
        if (!didReappearBurst) {
          purpleFlashBurst.setPosition(body.position.x, floorY + R * 0.35, body.position.z);
          purpleFlashBurst.burst(44);
          didReappearBurst = true;
          didVanishBurst = false;
        }

        reappearBurst.position.set(0, R * 0.45, 0);
        billboard(reappearBurst, camera);
        reappearBurst.scale.setScalar(R * (0.85 + (1 - flash) * 0.45));
        setOpacity(reappearBurst, flash * 0.8);
      } else {
        setOpacity(reappearBurst, 0);
      }

      if (inDash) {
        const nx = body.userData.strikerCoastNx ?? 0;
        const nz = body.userData.strikerCoastNz ?? 0;
        const yaw = Math.atan2(nx, nz);

        pierceBeam.position.set(-nx * R * 0.2, R * 0.4, -nz * R * 0.2);
        pierceBeam.rotation.y = yaw;
        billboard(pierceBeam, camera);
        pierceBeam.scale.set(1.1, 1.25 + Math.sin(dashSpin * 4) * 0.1, 1);
        setOpacity(pierceBeam, 0.55 + 0.2 * Math.sin(dashSpin * 5));

        for (let i = 0; i < dashStreaks.length; i++) {
          const s = dashStreaks[i];
          const lag = s.offset * R * 1.7;
          const side = (i - (dashStreaks.length - 1) * 0.5) * 0.09;
          s.mesh.position.set(-nx * lag + nz * side, R * 0.38, -nz * lag - nx * side);
          s.mesh.rotation.y = yaw;
          billboard(s.mesh, camera);
          setOpacity(s.mesh, 0.38 + 0.2 * Math.sin(dashSpin * 3.5 + i));
        }
      } else {
        setOpacity(pierceBeam, 0);
        for (const s of dashStreaks) setOpacity(s.mesh, 0);
      }
    },
    reset,
  };
}
