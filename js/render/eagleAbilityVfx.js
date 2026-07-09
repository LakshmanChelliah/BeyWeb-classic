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

/** Bold amber Counter Stance + Diving Crush wing/talon trails. */
export function createEagleAbilityVfx(scene) {
  const root = new THREE.Group();
  scene.add(root);

  const counterRing = new THREE.Mesh(
    new THREE.RingGeometry(0.95, 1.2, 56),
    makeMat(0xfbbf24, 0.5)
  );
  counterRing.rotation.x = -Math.PI / 2;
  counterRing.visible = false;
  root.add(counterRing);

  const counterInner = new THREE.Mesh(
    new THREE.RingGeometry(0.65, 0.9, 48),
    makeMat(0xf59e0b, 0.28)
  );
  counterInner.rotation.x = -Math.PI / 2;
  counterInner.visible = false;
  root.add(counterInner);

  const counterBurst = new THREE.Mesh(
    new THREE.RingGeometry(0.75, 1.45, 40),
    makeMat(0xfef3c7, 0.0)
  );
  counterBurst.rotation.x = -Math.PI / 2;
  counterBurst.visible = false;
  root.add(counterBurst);

  const counterFlash = new THREE.Mesh(
    new THREE.PlaneGeometry(2.2, 2.2),
    makeMat(0xfef3c7, 0)
  );
  counterFlash.visible = false;
  counterFlash.renderOrder = 8;
  root.add(counterFlash);

  const wings = [];
  for (let i = 0; i < 4; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 0.7),
      makeMat(i < 2 ? 0xfbbf24 : 0xf59e0b, 0.35)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    wings.push(mesh);
  }

  const talons = [];
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 3.0),
      makeMat(i === 2 ? 0xfef3c7 : 0xf59e0b, 0.65)
    );
    mesh.visible = false;
    mesh.renderOrder = 6;
    root.add(mesh);
    talons.push(mesh);
  }

  const diveCore = new THREE.Mesh(
    new THREE.PlaneGeometry(2.0, 2.0),
    makeMat(0xfef3c7, 0.4)
  );
  diveCore.visible = false;
  diveCore.renderOrder = 5;
  root.add(diveCore);

  const diveRibbon = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 3.5),
    makeMat(0xfbbf24, 0.3)
  );
  diveRibbon.visible = false;
  diveRibbon.renderOrder = 4;
  root.add(diveRibbon);

  const impactRing = new THREE.Mesh(
    new THREE.RingGeometry(0.4, 0.9, 48),
    makeMat(0xfef3c7, 0)
  );
  impactRing.rotation.x = -Math.PI / 2;
  impactRing.visible = false;
  impactRing.renderOrder = 7;
  root.add(impactRing);

  const impactBurst = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 2.6),
    makeMat(0xfef3c7, 0)
  );
  impactBurst.visible = false;
  impactBurst.renderOrder = 8;
  root.add(impactBurst);

  let hasLast = false;
  let spinT = 0;
  let impactT = 0;

  function reset() {
    root.visible = false;
    counterRing.visible = false;
    counterInner.visible = false;
    counterBurst.visible = false;
    counterFlash.visible = false;
    diveCore.visible = false;
    diveRibbon.visible = false;
    impactRing.visible = false;
    impactBurst.visible = false;
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
      const counterFlashT = body.userData.eagleCounterFlashT ?? 0;
      const divePhase = body.userData.eagleDivePhase;
      const diving = divePhase === 'ascend' || divePhase === 'hover' || divePhase === 'dive';
      const impact = body.userData.eagleImpactFlash ? 1 : 0;

      if (!counterActive && counterFlashT <= 0 && !diving && !impact && !body.userData.eagleDiveWindup) {
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
        const pulse = 0.5 + 0.5 * Math.sin(spinT * 16);
        counterRing.position.set(body.position.x, body.position.y + 0.08, body.position.z);
        counterRing.scale.setScalar(radius * (1.1 + pulse * 0.12));
        counterRing.material.opacity = 0.28 + pulse * 0.28;
        counterRing.rotation.z -= dt * 4.2;

        counterInner.position.set(body.position.x, body.position.y + 0.1, body.position.z);
        counterInner.scale.setScalar(radius * (0.98 + pulse * 0.08));
        counterInner.material.opacity = 0.16 + pulse * 0.16;
        counterInner.rotation.z += dt * 3.2;
      }

      counterBurst.visible = counterFlashT > 0;
      counterFlash.visible = counterFlashT > 0;
      if (counterFlashT > 0) {
        const t = 1 - clamp01(counterFlashT);
        counterBurst.position.set(body.position.x, body.position.y + 0.12, body.position.z);
        counterBurst.scale.setScalar(radius * (1.0 + t * 2.2));
        counterBurst.material.opacity = 0.55 * counterFlashT;
        counterBurst.rotation.z += dt * 10;
        counterFlash.position.copy(_pos);
        billboard(counterFlash, camera);
        counterFlash.scale.setScalar(1.4 + (1 - counterFlashT) * 1.2);
        counterFlash.material.opacity = 0.45 * counterFlashT;
      }

      const showWings =
        divePhase === 'ascend' || divePhase === 'hover' || body.userData.eagleDiveWindup;
      for (let i = 0; i < wings.length; i++) {
        const wing = wings[i];
        wing.visible = showWings;
        if (!showWings) continue;
        const side = i % 2 === 0 ? -1 : 1;
        const tier = Math.floor(i / 2);
        const flap = Math.sin(spinT * 8 + i) * 0.18;
        wing.position.copy(_pos)
          .addScaledVector(_right, side * radius * (0.9 + tier * 0.25 + flap))
          .addScaledVector(_dir, divePhase === 'hover' ? 0.2 - tier * 0.1 : -0.25 - tier * 0.1);
        billboard(wing, camera);
        wing.scale.set(1.05 + flap * 0.3, 0.95 + tier * 0.1, 1);
        wing.material.opacity = divePhase === 'hover' ? 0.32 : 0.22;
      }

      const showTalons = diving || body.userData.eagleDiveWindup;
      for (let i = 0; i < talons.length; i++) {
        const talon = talons[i];
        talon.visible = showTalons;
        if (!showTalons) continue;
        const fan = (i - 2) * 0.28;
        const back = divePhase === 'dive' ? 1.4 + i * 0.18 : -0.35 - i * 0.08;
        talon.position.copy(_pos)
          .addScaledVector(_dir, -back)
          .addScaledVector(_right, fan);
        billboard(talon, camera);
        const speed = clamp01(_vel.length() / 26);
        const phaseBoost = divePhase === 'dive' ? 1.45 : 0.85;
        talon.scale.set(1, phaseBoost + speed * 1.5, 1);
        talon.material.opacity = (0.32 + speed * 0.45) * (divePhase === 'hover' ? 0.7 : 1);
      }

      diveCore.visible = diving || impact > 0;
      diveRibbon.visible = divePhase === 'dive' || divePhase === 'ascend';
      if (diveCore.visible) {
        diveCore.position.copy(_pos);
        billboard(diveCore, camera);
        const lift = body.userData.flightLift ?? 0;
        const impactScale = impact ? 1.85 : 0.7 + clamp01(lift / 24) * 0.55;
        diveCore.scale.setScalar(topGroup.scale.x * impactScale);
        diveCore.material.opacity = impact ? 0.6 : 0.2 + clamp01(lift / 24) * 0.22;
      }
      if (diveRibbon.visible) {
        diveRibbon.position.copy(_pos).addScaledVector(_dir, divePhase === 'dive' ? 1.2 : -0.8);
        billboard(diveRibbon, camera);
        diveRibbon.scale.set(1, divePhase === 'dive' ? 1.6 : 1.1, 1);
        diveRibbon.material.opacity = divePhase === 'dive' ? 0.35 : 0.18;
      }

      if (impact) impactT = 0.28;
      if (impactT > 0) {
        impactT -= dt;
        const fade = clamp01(impactT / 0.28);
        impactRing.visible = fade > 0.02;
        impactBurst.visible = fade > 0.02;
        impactRing.position.set(body.position.x, body.position.y + 0.06, body.position.z);
        impactRing.scale.setScalar(radius * (1.2 + (1 - fade) * 2.6));
        impactRing.material.opacity = 0.6 * fade;
        impactBurst.position.copy(_pos);
        billboard(impactBurst, camera);
        impactBurst.scale.setScalar(1.3 + (1 - fade) * 1.6);
        impactBurst.material.opacity = 0.5 * fade;
      } else {
        impactRing.visible = false;
        impactBurst.visible = false;
      }
    },
    reset,
  };
}
