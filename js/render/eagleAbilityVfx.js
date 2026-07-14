/**
 * Earth Eagle - Counter Stance + Diving Crush VFX.
 * Canon Diving Crush: soar, gather wind, bright purple glow, dive crush.
 * Feather trails + talon dive; impact/bounce as dust+feathers (no brace rings).
 */
import * as THREE from 'three';
import { clamp01 } from '../utils/math.js';
import { CONFIG } from '../config.js';
import {
  createBurstSystem,
  ensureQuarksRuntime,
  Vector4,
} from './vfx/quarksRuntime.js';
import {
  createPurpleWindTrail,
  createImpactShockwave,
} from './vfx/presets.js';

const _pos = new THREE.Vector3();
const _lastPos = new THREE.Vector3();
const _vel = new THREE.Vector3();
const _dir = new THREE.Vector3(0, -1, 0);
const _right = new THREE.Vector3(1, 0, 0);

const PURPLE = 0xa855f7;
const PURPLE_LIGHT = 0xc084fc;
const PURPLE_PALE = 0xe9d5ff;
const PURPLE_HOT = 0xf5f3ff;
const AMBER = 0xfbbf24;
const AMBER_DEEP = 0xf59e0b;

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

export function createEagleAbilityVfx(scene) {
  ensureQuarksRuntime(scene);
  const root = new THREE.Group();
  scene.add(root);

  // Counter: orbiting amber sparks (stance read distinct from purple dive).
  const counterSparks = [];
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.45),
      makeMat(i % 2 === 0 ? AMBER : AMBER_DEEP, 0)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    counterSparks.push({ mesh, phase: (i / 10) * Math.PI * 2 });
  }

  // Dive wings - purple wind sheath (canon bright purple glow).
  const wings = [];
  for (let i = 0; i < 2; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 0.85),
      makeMat(PURPLE_LIGHT, 0.35)
    );
    mesh.visible = false;
    mesh.renderOrder = 5;
    root.add(mesh);
    wings.push(mesh);
  }

  const talons = [];
  for (let i = 0; i < 5; i++) {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.1, 2.8),
      makeMat(i === 2 ? PURPLE_HOT : PURPLE, 0.6)
    );
    mesh.visible = false;
    mesh.renderOrder = 6;
    root.add(mesh);
    talons.push(mesh);
  }

  const diveCore = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.7),
    makeMat(PURPLE_PALE, 0.35)
  );
  diveCore.visible = false;
  diveCore.renderOrder = 5;
  root.add(diveCore);

  // Soft purple wind aura disc (billboard, not a floor ring).
  const windAura = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.8),
    makeMat(PURPLE, 0)
  );
  windAura.visible = false;
  windAura.renderOrder = 4;
  root.add(windAura);

  const featherTrail = createPurpleWindTrail(scene);

  const impactDust = createBurstSystem(scene, {
    additive: false,
    dustyColor: 0xd4b896,
    startSpeed: [6, 16],
    startSize: [0.25, 0.85],
    gravity: -14,
    colorA: new Vector4(0.95, 0.82, 0.55, 0.95),
    colorB: new Vector4(0.55, 0.42, 0.25, 0),
  });

  const featherBurst = createBurstSystem(scene, {
    additive: true,
    startSpeed: [5, 14],
    startSize: [0.12, 0.45],
    gravity: -3,
    colorA: new Vector4(0.85, 0.55, 1, 1),
    colorB: new Vector4(0.55, 0.25, 0.9, 0),
  });

  const diveShock = createImpactShockwave(scene, { tint: 'purple' });

  let hasLast = false;
  let spinT = 0;
  let lastImpact = false;
  let lastBouncePulse = -1;

  function reset() {
    root.visible = false;
    diveCore.visible = false;
    windAura.visible = false;
    windAura.material.opacity = 0;
    for (const w of wings) w.visible = false;
    for (const t of talons) t.visible = false;
    for (const s of counterSparks) {
      s.mesh.visible = false;
      s.mesh.material.opacity = 0;
    }
    hasLast = false;
    lastImpact = false;
    lastBouncePulse = -1;
    featherTrail.stop();
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
      const impact = !!body.userData.eagleImpactFlash;
      const bouncePhase = body.userData.launchBouncePhase;
      const isBounceVictim = bouncePhase != null && body.userData.launchBounceSource === 'eagle';

      if (
        !counterActive &&
        counterFlash <= 0 &&
        !diving &&
        !impact &&
        !body.userData.eagleDiveWindup &&
        !isBounceVictim
      ) {
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

      // Counter stance - orbiting amber sparks, no rings.
      for (let i = 0; i < counterSparks.length; i++) {
        const s = counterSparks[i];
        s.mesh.visible = counterActive || counterFlash > 0;
        if (!s.mesh.visible) continue;
        s.phase += dt * 4.5;
        const orbitR = radius * (1.15 + 0.2 * Math.sin(s.phase));
        const h = 0.15 + Math.abs(Math.sin(s.phase * 1.5)) * 0.55;
        s.mesh.position.set(
          body.position.x + Math.cos(s.phase + spinT) * orbitR,
          body.position.y + h,
          body.position.z + Math.sin(s.phase + spinT) * orbitR
        );
        billboard(s.mesh, camera);
        s.mesh.material.opacity =
          (counterActive ? 0.35 : 0) + counterFlash * 0.45;
      }

      const showWings = diving || !!body.userData.eagleDiveWindup;
      for (let i = 0; i < wings.length; i++) {
        const wing = wings[i];
        wing.visible = showWings;
        if (!showWings) continue;
        const side = i === 0 ? -1 : 1;
        const flap = Math.sin(spinT * 14 + i) * 0.4;
        wing.position.copy(_pos);
        wing.position.addScaledVector(_right, side * (1.5 + flap * 0.25));
        wing.position.addScaledVector(_dir, -0.4);
        billboard(wing, camera);
        wing.scale.set(1.25 + Math.abs(flap) * 0.35, 0.85, 1);
        wing.material.color.setHex(PURPLE_LIGHT);
        wing.material.opacity = 0.32 + (divePhase === 'dive' ? 0.28 : 0.14);
      }

      const showTalons = divePhase === 'dive';
      for (let i = 0; i < talons.length; i++) {
        const talon = talons[i];
        talon.visible = showTalons;
        if (!showTalons) continue;
        const fan = (i - (talons.length - 1) * 0.5) * 0.12;
        talon.position.copy(_pos).addScaledVector(_dir, -0.5 - i * 0.15);
        talon.position.addScaledVector(_right, fan);
        const yaw = Math.atan2(_dir.x, _dir.z);
        const pitch = -Math.asin(Math.max(-1, Math.min(1, _dir.y)));
        talon.rotation.order = 'YXZ';
        talon.rotation.y = yaw;
        talon.rotation.x = pitch * 0.7;
        talon.material.opacity = 0.6;
      }

      diveCore.visible = diving;
      windAura.visible = diving || !!body.userData.eagleDiveWindup;
      if (diving || body.userData.eagleDiveWindup) {
        diveCore.position.copy(_pos);
        billboard(diveCore, camera);
        diveCore.scale.setScalar(0.75 + (divePhase === 'dive' ? 0.45 : 0.2));
        diveCore.material.opacity = divePhase === 'dive' ? 0.45 : 0.25;

        windAura.position.copy(_pos);
        billboard(windAura, camera);
        const auraPulse = 1 + Math.sin(spinT * 8) * 0.08;
        windAura.scale.setScalar((divePhase === 'dive' ? 1.35 : 1.05) * auraPulse);
        windAura.material.opacity = divePhase === 'dive' ? 0.22 : 0.14;

        featherTrail.follow(_pos.x, _pos.y, _pos.z, true);
      } else {
        featherTrail.stop();
        windAura.material.opacity = 0;
      }

      if (impact && !lastImpact) {
        impactDust.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.15, _pos.z);
        impactDust.burst(52);
        featherBurst.setPosition(_pos.x, _pos.y, _pos.z);
        featherBurst.burst(44);
        diveShock.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.25, _pos.z);
        diveShock.burst(36);
        body.userData.eagleImpactFlash = false;
      }
      lastImpact = impact;

      if (isBounceVictim && bouncePhase === 'bounce') {
        const pulse = body.userData.launchBouncePulseT ?? 0;
        if (pulse < 0.05 && lastBouncePulse > 0.1) {
          impactDust.setPosition(_pos.x, CONFIG.FLOOR_Y + 0.12, _pos.z);
          impactDust.burst(16);
        }
        lastBouncePulse = pulse;
      }
    },
    reset,
  };
}
