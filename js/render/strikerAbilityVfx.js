import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';
import { STRIKER_VANISH_DUR } from '../game/abilities.js';

const TEAL = 0x14b8a6;
const TEAL_LIGHT = 0x2dd4bf;
const TEAL_PALE = 0x5eead4;
const TEAL_WHITE = 0xccfbf1;

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

/** Teal Blitz Charge trails + Lightning Sword Flash vanish / reappear / dash. */
export function createStrikerAbilityVfx(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const blitzGroup = new THREE.Group();
  const vanishGroup = new THREE.Group();
  const dashGroup = new THREE.Group();
  root.add(blitzGroup);
  root.add(vanishGroup);
  root.add(dashGroup);

  // --- Blitz Charge ---
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

  const blitzRing = new THREE.Mesh(
    new THREE.RingGeometry(0.85, 0.98, 32),
    makeMat(TEAL, 0)
  );
  blitzRing.rotation.x = -Math.PI / 2;
  blitzRing.renderOrder = 3;
  blitzGroup.add(blitzRing);

  const blitzCore = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 0.95),
    makeMat(TEAL_WHITE, 0)
  );
  blitzCore.renderOrder = 7;
  blitzGroup.add(blitzCore);

  // --- Lightning Sword Flash ---
  const vanishRing = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.95, 32),
    makeMat(TEAL_LIGHT, 0)
  );
  vanishRing.rotation.x = -Math.PI / 2;
  vanishRing.renderOrder = 8;
  vanishGroup.add(vanishRing);

  const vanishCore = new THREE.Mesh(
    new THREE.PlaneGeometry(1.25, 1.25),
    makeMat(TEAL_WHITE, 0)
  );
  vanishCore.renderOrder = 9;
  vanishGroup.add(vanishCore);

  const vanishStreaks = [];
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, 1.55),
      makeMat(TEAL_PALE, 0)
    );
    mesh.renderOrder = 7;
    vanishGroup.add(mesh);
    vanishStreaks.push({ mesh, angle: (i / 8) * Math.PI * 2 });
  }

  const afterimage = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.2),
    makeMat(TEAL, 0, false)
  );
  afterimage.renderOrder = 4;
  vanishGroup.add(afterimage);

  const reappearRing = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 1.05, 36),
    makeMat(TEAL_WHITE, 0)
  );
  reappearRing.rotation.x = -Math.PI / 2;
  reappearRing.renderOrder = 9;
  dashGroup.add(reappearRing);

  const reappearBurst = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    makeMat(TEAL_WHITE, 0)
  );
  reappearBurst.renderOrder = 10;
  dashGroup.add(reappearBurst);

  // Sword-motif dash streaks (elongated teal blades, not literal props).
  const dashStreaks = [];
  for (let i = 0; i < 6; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.05, 2.0),
      makeMat(i % 2 === 0 ? TEAL_WHITE : TEAL_PALE, 0)
    );
    mesh.renderOrder = 6;
    dashGroup.add(mesh);
    dashStreaks.push({ mesh, offset: i / 6 });
  }

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

  function hideBlitz() {
    for (const s of blitzStreaks) setOpacity(s, 0);
    for (const sp of blitzSparks) setOpacity(sp.mesh, 0);
    setOpacity(blitzRing, 0);
    setOpacity(blitzCore, 0);
  }

  function hideFlash() {
    setOpacity(vanishRing, 0);
    setOpacity(vanishCore, 0);
    setOpacity(afterimage, 0);
    setOpacity(reappearRing, 0);
    setOpacity(reappearBurst, 0);
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

      if (!blitzing && !inFlash) {
        reset();
        return;
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

        if (boostT < 0.26) {
          const t = boostT / 0.26;
          blitzRing.position.set(_pos.x, yBase + 0.04, _pos.z);
          blitzRing.scale.setScalar(R * (1 + t * 1.5));
          setOpacity(blitzRing, 0.28 * (1 - t));
        } else {
          setOpacity(blitzRing, 0);
        }

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

        vanishRing.scale.setScalar(R * (0.75 + t * 2.0));
        setOpacity(vanishRing, burst * 0.55);

        vanishCore.position.set(0, R * 0.42, 0);
        billboard(vanishCore, camera);
        vanishCore.scale.setScalar(R * (1.0 - t * 0.5));
        setOpacity(vanishCore, burst * 0.7);

        afterimage.position.set(0, R * 0.4, 0);
        billboard(afterimage, camera);
        afterimage.scale.setScalar(R * 0.95);
        setOpacity(afterimage, (1 - t) * 0.32);

        for (const s of vanishStreaks) {
          const len = R * (1.0 + t * 2.2);
          s.mesh.position.set(
            Math.cos(s.angle) * len * 0.45,
            R * 0.32 + Math.sin(s.angle * 2) * 0.06,
            Math.sin(s.angle) * len * 0.45
          );
          s.mesh.rotation.y = s.angle;
          billboard(s.mesh, camera);
          setOpacity(s.mesh, burst * 0.4 * (0.7 + 0.3 * Math.sin(s.angle * 3)));
        }

        setOpacity(reappearRing, 0);
        setOpacity(reappearBurst, 0);
        for (const s of dashStreaks) setOpacity(s.mesh, 0);
        return;
      }

      vanishGroup.position.set(
        body.userData.strikerVanishX ?? body.position.x,
        floorY,
        body.userData.strikerVanishZ ?? body.position.z
      );
      setOpacity(vanishCore, 0);
      setOpacity(vanishRing, 0);
      setOpacity(afterimage, 0);
      for (const s of vanishStreaks) setOpacity(s.mesh, 0);

      dashGroup.position.set(body.position.x, floorY, body.position.z);
      dashSpin += dt * 8;

      if (reappearing) {
        const flash = phase === 'reappear' ? reappear : 0;
        reappearRing.scale.setScalar(R * (1.25 + (1 - flash) * 1.35));
        setOpacity(reappearRing, flash * 0.65);

        reappearBurst.position.set(0, R * 0.45, 0);
        billboard(reappearBurst, camera);
        reappearBurst.scale.setScalar(R * (0.8 + (1 - flash) * 0.4));
        setOpacity(reappearBurst, flash * 0.75);
      } else {
        setOpacity(reappearRing, 0);
        setOpacity(reappearBurst, 0);
      }

      if (inDash) {
        const nx = body.userData.strikerCoastNx ?? 0;
        const nz = body.userData.strikerCoastNz ?? 0;
        for (let i = 0; i < dashStreaks.length; i++) {
          const s = dashStreaks[i];
          const lag = s.offset * R * 1.6;
          const side = (i - (dashStreaks.length - 1) * 0.5) * 0.08;
          s.mesh.position.set(-nx * lag + nz * side, R * 0.38, -nz * lag - nx * side);
          s.mesh.rotation.y = Math.atan2(nx, nz);
          billboard(s.mesh, camera);
          setOpacity(s.mesh, 0.32 + 0.18 * Math.sin(dashSpin * 3.5 + i));
        }
      } else {
        for (const s of dashStreaks) setOpacity(s.mesh, 0);
      }
    },
    reset,
  };
}
