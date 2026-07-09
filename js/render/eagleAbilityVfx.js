import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';

const _pos = new THREE.Vector3();
const _lastPos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _dir = new THREE.Vector3(0, -1, 0);
const _right = new THREE.Vector3(1, 0, 0);

function makeMat(color, opacity, { additive = true, doubleSide = true } = {}) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
}

function billboard(mesh, camera) {
  mesh.quaternion.copy(camera.quaternion);
}

/** Amber Counter Stance brace + Diving Crush wing/talon trails. */
export function createEagleAbilityVfx(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const counterRing = new THREE.Mesh(
    new THREE.RingGeometry(1.0, 1.14, 48),
    makeMat(0xfbbf24, 0.4)
  );
  counterRing.rotation.x = -Math.PI / 2;
  counterRing.visible = false;
  root.add(counterRing);

  const counterInner = new THREE.Mesh(
    new THREE.RingGeometry(0.72, 0.88, 40),
    makeMat(0xf59e0b, 0.2)
  );
  counterInner.rotation.x = -Math.PI / 2;
  counterInner.visible = false;
  root.add(counterInner);

  const counterBurst = new THREE.Mesh(
    new THREE.RingGeometry(0.82, 1.28, 32),
    makeMat(0xfef3c7, 0.0)
  );
  counterBurst.rotation.x = -Math.PI / 2;
  counterBurst.visible = false;
  root.add(counterBurst);

  // Simple wing planes (not ornate bird silhouettes).
  const wings = [];
  for (let i = 0; i < 2; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.6, 0.55),
      makeMat(0xfbbf24, 0.28)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    wings.push(mesh);
  }

  const talons = [];
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.09, 2.4),
      makeMat(i === 1 ? 0xfef3c7 : 0xf59e0b, 0.55)
    );
    mesh.visible = false;
    mesh.renderOrder = 6;
    root.add(mesh);
    talons.push(mesh);
  }

  const diveCore = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 1.55),
    makeMat(0xfef3c7, 0.3)
  );
  diveCore.visible = false;
  diveCore.renderOrder = 5;
  root.add(diveCore);

  const impactRing = new THREE.Mesh(
    new THREE.RingGeometry(0.5, 0.78, 36),
    makeMat(0xfef3c7, 0)
  );
  impactRing.rotation.x = -Math.PI / 2;
  impactRing.visible = false;
  impactRing.renderOrder = 7;
  root.add(impactRing);

  let hasLast = false;
  let spinT = 0;
  let impactT = 0;

  function reset() {
    root.visible = false;
    counterRing.visible = false;
    counterInner.visible = false;
    counterBurst.visible = false;
    diveCore.visible = false;
    impactRing.visible = false;
    for (const w of wings) w.visible = false;
    for (const t of talons) t.visible = false;
    hasLast = false;
    impactT = 0;
    _vel.set(0, 0, 0);
  }

  return {
    update(topGroup, body, camera, dt) {
      if (!topGroup || !body || !camera) {
        reset();
        return;
      }

      const counterActive = !!body.userData.counterStance;
      const counterFlash = body.userData.eagleCounterFlashT ?? 0;
      const divePhase = body.userData.eagleDivePhase;
      const diving = divePhase === 'ascend' || divePhase === 'hover' || divePhase === 'dive';
      const impact = body.userData.eagleImpactFlash ? 1 : 0;

      if (!counterActive && counterFlash <= 0 && !diving && !impact && !body.userData.eagleDiveWindup) {
        reset();
        return;
      }

      root.visible = true;
      topGroup.getWorldPosition(_pos);
      spinT += dt;

      if (hasLast) {
        _vel.subVectors(_pos, _lastPos).divideScalar(Math.max(dt, 0.001));
      } else {
        _vel.set(0, 0, 0);
        hasLast = true;
      }
      _lastPos.copy(_pos);

      if (_vel.lengthSq() > 0.25) {
        _dir.copy(_vel).normalize();
      } else if (divePhase === 'dive') {
        _dir.set(0, -1, 0);
      } else {
        _dir.set(0, 1, 0);
      }
      _right.crossVectors(_dir, camera.up).normalize();
      if (_right.lengthSq() < 1e-4) _right.set(1, 0, 0);

      const radius = body.userData.outerRadius ?? 1.6;
      counterRing.visible = counterActive;
      counterInner.visible = counterActive;
      if (counterActive) {
        const pulse = 0.5 + 0.5 * Math.sin(spinT * 12);
        counterRing.position.set(body.position.x, body.position.y + 0.08, body.position.z);
        counterRing.scale.setScalar(radius * (1.06 + pulse * 0.06));
        counterRing.material.opacity = 0.18 + pulse * 0.18;
        counterRing.rotation.z -= dt * 2.8;

        counterInner.position.set(body.position.x, body.position.y + 0.1, body.position.z);
        counterInner.scale.setScalar(radius * (0.95 + pulse * 0.04));
        counterInner.material.opacity = 0.1 + pulse * 0.1;
        counterInner.rotation.z += dt * 2.2;
      }

      counterBurst.visible = counterFlash > 0;
      if (counterFlash > 0) {
        const t = 1 - clamp01(counterFlash);
        counterBurst.position.set(body.position.x, body.position.y + 0.12, body.position.z);
        counterBurst.scale.setScalar(radius * (1.0 + t * 1.4));
        counterBurst.material.opacity = 0.35 * counterFlash;
        counterBurst.rotation.z += dt * 6;
      }

      const showWings =
        divePhase === 'ascend' || divePhase === 'hover' || body.userData.eagleDiveWindup;
      for (let i = 0; i < wings.length; i++) {
        const wing = wings[i];
        wing.visible = showWings;
        if (!showWings) continue;
        const side = i === 0 ? -1 : 1;
        const flap = Math.sin(spinT * 6 + i) * 0.12;
        wing.position.copy(_pos)
          .addScaledVector(_right, side * radius * (0.85 + flap))
          .addScaledVector(_dir, divePhase === 'hover' ? 0.15 : -0.2);
        billboard(wing, camera);
        wing.scale.set(0.9 + flap * 0.2, 0.85, 1);
        wing.material.opacity = divePhase === 'hover' ? 0.22 : 0.16;
      }

      const showTalons = diving || body.userData.eagleDiveWindup;
      for (let i = 0; i < talons.length; i++) {
        const talon = talons[i];
        talon.visible = showTalons;
        if (!showTalons) continue;
        const fan = (i - 1) * 0.3;
        const back = divePhase === 'dive' ? 1.2 + i * 0.14 : -0.3 - i * 0.07;
        talon.position.copy(_pos)
          .addScaledVector(_dir, -back)
          .addScaledVector(_right, fan);
        billboard(talon, camera);
        const speed = clamp01(_vel.length() / 26);
        const phaseBoost = divePhase === 'dive' ? 1.2 : 0.75;
        talon.scale.set(1, phaseBoost + speed * 1.2, 1);
        talon.material.opacity = (0.22 + speed * 0.35) * (divePhase === 'hover' ? 0.55 : 1);
      }

      diveCore.visible = diving || impact > 0;
      if (diveCore.visible) {
        diveCore.position.copy(_pos);
        billboard(diveCore, camera);
        const lift = body.userData.flightLift ?? 0;
        const impactScale = impact ? 1.45 : 0.55 + clamp01(lift / 24) * 0.4;
        diveCore.scale.setScalar(topGroup.scale.x * impactScale);
        diveCore.material.opacity = impact ? 0.42 : 0.12 + clamp01(lift / 24) * 0.14;
      }

      if (impact) impactT = 0.2;
      if (impactT > 0) {
        impactT -= dt;
        const fade = clamp01(impactT / 0.2);
        impactRing.visible = fade > 0.02;
        impactRing.position.set(body.position.x, body.position.y + 0.06, body.position.z);
        impactRing.scale.setScalar(radius * (1.1 + (1 - fade) * 1.8));
        impactRing.material.opacity = 0.4 * fade;
      } else {
        impactRing.visible = false;
      }
    },
    reset,
  };
}
