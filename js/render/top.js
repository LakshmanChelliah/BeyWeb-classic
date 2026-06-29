import * as THREE from 'three';
import { fitColliderToModel } from '../physics/top.js';
import {
  createFallbackTopMesh,
  getTopModelTemplate,
  cloneTopModel,
  preloadTopModel,
} from './modelCache.js';

export { createFallbackTopMesh, preloadTopModel } from './modelCache.js';

function nextLoadToken(parentGroup) {
  const token = (parentGroup.userData.loadToken ?? 0) + 1;
  parentGroup.userData.loadToken = token;
  return token;
}

function attachTemplate(parentGroup, template, physicsBody, onReady) {
  parentGroup.clear();
  const instance = cloneTopModel(template);
  parentGroup.add(instance);

  if (physicsBody) {
    const radius = fitColliderToModel(physicsBody, instance);
    if (onReady) onReady(radius);
  }
}

export function loadTopModel(url, fallbackColor, parentGroup, physicsBody, onReady) {
  const token = nextLoadToken(parentGroup);

  const template = getTopModelTemplate(url);
  if (template) {
    attachTemplate(parentGroup, template, physicsBody, onReady);
    return;
  }

  preloadTopModel(url, fallbackColor).then((loaded) => {
    if (parentGroup.userData.loadToken !== token) return;
    if (!loaded) return;
    attachTemplate(parentGroup, loaded, physicsBody, onReady);
  });
}

export function createTopGroups(scene) {
  const playerGroup = new THREE.Group();
  const aiGroup = new THREE.Group();
  scene.add(playerGroup, aiGroup);
  return { playerGroup, aiGroup };
}

const _emissive = new THREE.Color();

/**
 * Tints a top's materials with an emissive glow for ability VFX.
 * intensity 0 removes the glow. Safe to call every frame.
 */
export function setTopEmissive(group, colorHex, intensity) {
  if (!group) return;
  _emissive.set(colorHex ?? 0x000000);
  group.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!mat || !mat.emissive) continue;
      mat.emissive.copy(_emissive);
      mat.emissiveIntensity = intensity;
    }
  });
}
