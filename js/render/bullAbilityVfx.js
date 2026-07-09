import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';
import { BULL_STAMPEDE_DURATION, BULL_UPPERCUT_WINDUP, BULL_DASH_BUILD_DUR } from '../game/abilities.js';

const _pos = new THREE.Vector3();
const _lastPos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _smoothVel = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _smoothDir = new THREE.Vector3();
const _right = new THREE.Vector3();

const RED_CORE = 0xdc2626;
const RED_BRIGHT = 0xef4444;
const ORANGE = 0xfb923c;
const AMBER = 0xfbbf24;
const PALE = 0xfca5a5;

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

/** Dense red stampede dust, uppercut gather, dash streak, and victim flip burst. */
export function createBullAbilityVfx(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const dustStreaks = [];
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.07, 1.6),
      makeMat(ORANGE, 0.48 - i * 0.035)
    );
    mesh.visible = false;
    mesh.renderOrder = 4;
    root.add(mesh);
    dustStreaks.push(mesh);
  }

  const hoofSparks = [];
  for (let i = 0; i < 8; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.16),
      makeMat(AMBER, 0)
    );
    mesh.renderOrder = 5;
    root.add(mesh);
    hoofSparks.push({ mesh, phase: (i / 8) * Math.PI * 2 });
  }

  const emberRing = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.08, 48),
    makeMat(RED_BRIGHT, 0)
  );
  emberRing.rotation.x = -Math.PI / 2;
  emberRing.renderOrder = 3;
  root.add(emberRing);

  const emberOuter = new THREE.Mesh(
    new THREE.RingGeometry(1.05, 1.28, 48),
    makeMat(ORANGE, 0)
  );
  emberOuter.rotation.x = -Math.PI / 2;
  emberOuter.renderOrder = 2;
  root.add(emberOuter);

  const gatherPool = [];
  for (let i = 0; i < 16; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.12),
      makeMat(RED_CORE, 0)
    );
    mesh.renderOrder = 6;
    root.add(mesh);
    gatherPool.push({ mesh, phase: (i / 16) * Math.PI * 2 });
  }

  const hornGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(0.95, 1.5),
    makeMat(RED_BRIGHT, 0)
  );
  hornGlow.renderOrder = 6;
  root.add(hornGlow);

  const hornCore = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.9),
    makeMat(AMBER, 0)
  );
  hornCore.renderOrder = 7;
  root.add(hornCore);

  const impactRing = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.85, 48),
    makeMat(AMBER, 0)
  );
  impactRing.rotation.x = -Math.PI / 2;
  impactRing.renderOrder = 8;
  root.add(impactRing);

  const debrisPool = [];
  for (let i = 0; i < 14; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 0.1),
      makeMat(ORANGE, 0)
    );
    mesh.renderOrder = 7;
    root.add(mesh);
    debrisPool.push({ mesh, angle: (i / 14) * Math.PI * 2 });
  }

  const flipBurst = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 1.4),
    makeMat(PALE, 0)
  );
  flipBurst.renderOrder = 6;
  root.add(flipBurst);

  const flipRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.9, 40),
    makeMat(RED_BRIGHT, 0)
  );
  flipRing.rotation.x = -Math.PI / 2;
  flipRing.renderOrder = 5;
  root.add(flipRing);

  let hasLast = false;
  let smoothSpeed = 0;
  let impactT = 0;
  let wasStampede = false;
  let wasUpper = false;

  function billboard(mesh, camera) {
    mesh.quaternion.copy(camera.quaternion);
  }

  function reset() {
    root.visible = false;
    hasLast = false;
    smoothSpeed = 0;
    impactT = 0;
    wasStampede = false;
    wasUpper = false;
    _smoothVel.set(0, 0, 0);
    _smoothDir.set(0, 0, -1);
    for (const s of dustStreaks) s.visible = false;
    for (const sp of hoofSparks) sp.mesh.material.opacity = 0;
    emberRing.material.opacity = 0;
    emberOuter.material.opacity = 0;
    impactRing.material.opacity = 0;
    hornGlow.material.opacity = 0;
    hornCore.material.opacity = 0;
    flipRing.material.opacity = 0;
    for (const g of gatherPool) g.mesh.material.opacity = 0;
    for (const d of debrisPool) d.mesh.material.opacity = 0;
    flipBurst.material.opacity = 0;
  }

  reset();

  return {
    update(topGroup, body, camera, dt) {
      if (!topGroup || !body || !camera) {
        reset();
        return;
      }

      const stampeding = !!body.userData.stampeding;
      const phase = body.userData.bullUpperPhase;
      const inUpper = phase === 'windup' || phase === 'dash';
      const flipBurstT = body.userData.bullFlipBurstT ?? 0;

      if (!stampeding && !inUpper && flipBurstT <= 0 && impactT <= 0) {
        reset();
        return;
      }

      root.visible = true;
      topGroup.getWorldPosition(_pos);
      const R = body.userData.outerRadius ?? CONFIG.DEFAULT_OUTER_RADIUS;
      const yBase = body.position.y + (body.userData.visualYOffset ?? 0) * 0.35;

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
      } else if (body.userData.bullCoastNx != null && body.userData.bullCoastNz != null) {
        _dir.set(body.userData.bullCoastNx, 0, body.userData.bullCoastNz);
      } else if (body.velocity) {
        const len = Math.hypot(body.velocity.x, body.velocity.z);
        if (len > 0.15) _dir.set(body.velocity.x / len, 0, body.velocity.z / len);
      }
      _smoothDir.lerp(_dir, blend);
      if (_smoothDir.lengthSq() > 1e-6) _smoothDir.normalize();
      _right.crossVectors(_smoothDir, camera.up).normalize();
      if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);

      if (stampeding) {
        wasStampede = true;
        const t = body.userData.stampedeT ?? 0;
        const life = clamp01(1 - t / BULL_STAMPEDE_DURATION);
        const speedFactor = clamp01(smoothSpeed / 16);
        const intensity = (0.6 + speedFactor * 0.6) * (0.4 + life * 0.7);

        const pulse = 0.55 + 0.45 * Math.sin(t * 8.5);
        emberRing.position.set(_pos.x, yBase + 0.04, _pos.z);
        emberRing.scale.setScalar(R * (1.2 + pulse * 0.4));
        emberRing.material.opacity = 0.38 * intensity * pulse;
        emberOuter.position.copy(emberRing.position);
        emberOuter.scale.setScalar(R * (1.35 + pulse * 0.5));
        emberOuter.material.opacity = 0.18 * intensity * pulse;

        const streakLen = 0.95 + speedFactor * 2.4;
        const yaw = Math.atan2(_smoothDir.x, _smoothDir.z);
        for (let i = 0; i < dustStreaks.length; i++) {
          const streak = dustStreaks[i];
          const side = i % 2 === 0 ? 1 : -1;
          const offset = (Math.floor(i / 2) + 0.5) * 0.22;
          streak.visible = speedFactor > 0.04;
          if (!streak.visible) continue;
          streak.position
            .copy(_pos)
            .addScaledVector(_right, side * R * 0.6)
            .addScaledVector(_smoothDir, -offset - streakLen * 0.5);
          streak.position.y = yBase + 0.02;
          streak.rotation.set(0, yaw, 0);
          streak.scale.set(1, streakLen, 1);
          streak.material.opacity = Math.max(0.06, (0.45 - i * 0.03) * intensity);
        }

        for (const sp of hoofSparks) {
          sp.phase += dt * (9 + speedFactor * 8);
          const side = Math.sin(sp.phase) > 0 ? 1 : -1;
          sp.mesh.position
            .copy(_pos)
            .addScaledVector(_right, side * R * 0.78)
            .addScaledVector(_smoothDir, -0.4);
          sp.mesh.position.y = yBase + 0.08 + Math.abs(Math.sin(sp.phase * 2)) * 0.12;
          billboard(sp.mesh, camera);
          sp.mesh.material.opacity = speedFactor > 0.08 ? 0.45 * intensity : 0;
        }
        hornGlow.material.opacity = 0;
        hornCore.material.opacity = 0;
      } else if (wasStampede) {
        emberRing.material.opacity *= 0.85;
        emberOuter.material.opacity *= 0.85;
        if (emberRing.material.opacity < 0.02) wasStampede = false;
      }

      if (inUpper) {
        wasUpper = true;
        const phaseT = body.userData.bullUpperPhaseT ?? 0;

        if (phase === 'windup') {
          const wind = clamp01(phaseT / BULL_UPPERCUT_WINDUP);
          for (let i = 0; i < gatherPool.length; i++) {
            const g = gatherPool[i];
            const tr = g.phase + phaseT * 5;
            const orbit = R * (2.0 - wind * 1.3);
            g.mesh.position.set(
              _pos.x + Math.cos(tr) * orbit,
              yBase + 0.25 + Math.sin(tr * 2) * 0.15,
              _pos.z + Math.sin(tr) * orbit
            );
            billboard(g.mesh, camera);
            g.mesh.material.opacity = 0.3 + 0.45 * Math.sin(tr * 3) * wind;
            g.mesh.scale.setScalar(0.8 + wind * 0.5);
          }
          hornGlow.position.copy(_pos);
          hornGlow.position.y = yBase + 0.4;
          hornGlow.position.addScaledVector(_smoothDir, 0.2);
          billboard(hornGlow, camera);
          hornGlow.scale.set(0.9 + wind * 0.55, 1.1 + wind * 0.6, 1);
          hornGlow.material.opacity = 0.25 + wind * 0.45;
          hornCore.position.copy(hornGlow.position);
          billboard(hornCore, camera);
          hornCore.scale.set(0.7 + wind * 0.4, 0.9 + wind * 0.5, 1);
          hornCore.material.opacity = 0.2 + wind * 0.4;
          for (const s of dustStreaks) s.visible = false;
        } else if (phase === 'dash') {
          for (const g of gatherPool) g.mesh.material.opacity = 0;
          const build = clamp01(phaseT / BULL_DASH_BUILD_DUR);
          const intensity = 0.45 + build * 0.55;
          const streakLen = 1.1 + build * 1.8;
          const yaw = Math.atan2(_smoothDir.x, _smoothDir.z);
          for (let i = 0; i < dustStreaks.length; i++) {
            const streak = dustStreaks[i];
            const side = i % 2 === 0 ? 1 : -1;
            const offset = (Math.floor(i / 2) + 0.5) * 0.2;
            streak.visible = true;
            streak.position
              .copy(_pos)
              .addScaledVector(_right, side * R * 0.55)
              .addScaledVector(_smoothDir, -offset - streakLen * 0.5);
            streak.position.y = yBase + 0.03;
            streak.rotation.set(0, yaw, 0);
            streak.scale.set(1, streakLen, 1);
            streak.material.opacity = Math.max(0.08, (0.42 - i * 0.025) * intensity);
          }
          emberRing.position.set(_pos.x, yBase + 0.04, _pos.z);
          emberRing.scale.setScalar(R * (1.15 + build * 0.3));
          emberRing.material.opacity = 0.28 * intensity;
          emberOuter.position.copy(emberRing.position);
          emberOuter.scale.setScalar(R * (1.3 + build * 0.35));
          emberOuter.material.opacity = 0.14 * intensity;
          hornGlow.position.copy(_pos);
          hornGlow.position.y = yBase + 0.35;
          billboard(hornGlow, camera);
          hornGlow.material.opacity = 0.35 + build * 0.35;
          hornCore.position.copy(hornGlow.position);
          billboard(hornCore, camera);
          hornCore.material.opacity = 0.3 + build * 0.3;
        } else {
          for (const g of gatherPool) g.mesh.material.opacity = 0;
          for (const s of dustStreaks) s.visible = false;
          hornGlow.material.opacity = 0;
          hornCore.material.opacity = 0;
        }
      } else if (wasUpper && !stampeding) {
        emberRing.material.opacity *= 0.88;
        emberOuter.material.opacity *= 0.88;
        hornGlow.material.opacity *= 0.85;
        hornCore.material.opacity *= 0.85;
        if (emberRing.material.opacity < 0.02) wasUpper = false;
      }

      if (body.userData.bullImpactFlash) {
        impactT = 0.28;
        const ix = body.userData.bullImpactX ?? _pos.x;
        const iz = body.userData.bullImpactZ ?? _pos.z;
        impactRing.position.set(ix, yBase + 0.08, iz);
        impactRing.scale.setScalar(R * 2.6);
        impactRing.material.opacity = 0.85;

        for (const d of debrisPool) {
          const spread = R * 2.0;
          d.mesh.position.set(
            ix + Math.cos(d.angle) * spread,
            yBase + 0.12 + Math.sin(d.angle * 3) * 0.2,
            iz + Math.sin(d.angle) * spread
          );
          billboard(d.mesh, camera);
          d.mesh.material.opacity = 0.7;
          d.mesh.scale.setScalar(1.2);
        }
      }

      if (impactT > 0) {
        impactT -= dt;
        const fade = clamp01(impactT / 0.28);
        impactRing.material.opacity = Math.max(impactRing.material.opacity, 0) * fade;
        for (const d of debrisPool) {
          d.mesh.material.opacity *= fade;
        }
      }

      if (flipBurstT > 0) {
        flipBurst.position.copy(_pos);
        flipBurst.position.y = yBase + 0.3;
        billboard(flipBurst, camera);
        const f = clamp01(flipBurstT);
        flipBurst.scale.setScalar(R * (1.4 + (1 - f) * 1.0));
        flipBurst.material.opacity = 0.65 * f;
        flipRing.position.set(_pos.x, yBase + 0.08, _pos.z);
        flipRing.scale.setScalar(R * (1.2 + (1 - f) * 1.5));
        flipRing.material.opacity = 0.4 * f;
      } else {
        flipBurst.material.opacity = 0;
        flipRing.material.opacity = 0;
      }
    },
    reset,
  };
}
