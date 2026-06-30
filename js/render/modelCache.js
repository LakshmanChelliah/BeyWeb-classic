import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from '../config.js';

const gltfLoader = new GLTFLoader();
const _templates = new Map();
const _inFlight = new Map();

function orientSpinAxisToY(object) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());

  if (size.y < size.x * 0.75 && size.y < size.z * 0.75) return;

  if (size.x < size.y * 0.75 && size.x < size.z * 0.75) {
    object.rotation.z = Math.PI / 2;
    return;
  }

  if (size.z < size.x * 0.75 && size.z < size.y * 0.75) {
    object.rotation.x = -Math.PI / 2;
    return;
  }

  object.rotation.x = -Math.PI / 2;
}

function centerModelOnAxis(object) {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  object.position.set(-center.x, -center.y, -center.z);
}

export function createFallbackTopMesh(color) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, metalness: 0.7, roughness: 0.25 });
  const r = CONFIG.DEFAULT_OUTER_RADIUS;
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.85, r, CONFIG.TOP_HEIGHT * 0.55, 20),
    mat
  );
  body.position.y = CONFIG.TOP_HEIGHT * 0.12;
  body.castShadow = true;
  const tip = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 0.35, r * 0.7, CONFIG.TOP_HEIGHT * 0.35, 16),
    mat
  );
  tip.position.y = CONFIG.TOP_HEIGHT * 0.45;
  tip.castShadow = true;
  group.add(body, tip);
  return group;
}

function applyModelMaterials(model, meta = {}) {
  model.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    for (const mat of mats) {
      if (!mat) continue;
      if (child.geometry?.attributes?.color) mat.vertexColors = true;
      if (meta.metalness != null) mat.metalness = meta.metalness;
      if (meta.roughness != null) mat.roughness = meta.roughness;
      if (mat.transparent || mat.alphaTest > 0) {
        mat.depthWrite = mat.opacity >= 0.99;
      }
    }
  });
}

/** Builds a scaled, oriented holder group from a loaded GLTF scene. */
export function prepareTopModelHolder(gltf, meta = {}) {
  const model = gltf.scene;
  applyModelMaterials(model, meta);

  const modelHolder = new THREE.Group();
  modelHolder.add(model);
  orientSpinAxisToY(modelHolder);
  if (meta.poleToY) modelHolder.rotation.x = Math.PI / 2;
  if (meta.bullSpinFix) model.rotation.z = Math.PI / 2;

  const box = new THREE.Box3().setFromObject(modelHolder);
  const size = box.getSize(new THREE.Vector3());
  const scale = (CONFIG.TOP_HEIGHT / size.y) * 1.1;
  modelHolder.scale.setScalar(scale);
  centerModelOnAxis(modelHolder);

  return modelHolder;
}

function prepareFallbackHolder(fallbackColor = 0x888888) {
  const fallback = createFallbackTopMesh(fallbackColor);
  centerModelOnAxis(fallback);
  return fallback;
}

function cacheKey(url, meta) {
  if (!meta || Object.keys(meta).length === 0) return url;
  return `${url}::${JSON.stringify(meta)}`;
}

function loadAndCache(url, fallbackColor, meta) {
  return new Promise((resolve) => {
    gltfLoader.load(
      url,
      (gltf) => {
        const holder = prepareTopModelHolder(gltf, meta);
        _templates.set(cacheKey(url, meta), holder);
        resolve(holder);
      },
      undefined,
      () => {
        const holder = prepareFallbackHolder(fallbackColor);
        _templates.set(cacheKey(url, meta), holder);
        resolve(holder);
      }
    );
  });
}

/** Returns a cached prepared template, or null if not loaded yet. */
export function getTopModelTemplate(url, meta) {
  return _templates.get(cacheKey(url, meta)) ?? null;
}

/** Deep-clones a template so each top gets independent materials (emissive VFX). */
export function cloneTopModel(template) {
  return template.clone(true);
}

/**
 * Preloads and caches a bey GLB. Deduplicates concurrent requests for the same URL.
 * @param {string} url
 * @param {number} [fallbackColor=0x888888]
 * @param {object} [meta] — modelMeta from bey roster
 */
export function preloadTopModel(url, fallbackColor = 0x888888, meta) {
  if (!url) return Promise.resolve(null);
  const key = cacheKey(url, meta);
  if (_templates.has(key)) return Promise.resolve(_templates.get(key));
  if (_inFlight.has(key)) return _inFlight.get(key);

  const promise = loadAndCache(url, fallbackColor, meta).finally(() => {
    _inFlight.delete(key);
  });
  _inFlight.set(key, promise);
  return promise;
}

/** Awaits both match beys being cached before spawn. */
export async function ensureMatchModelsReady(playerBey, aiBey) {
  await Promise.all([
    preloadTopModel(playerBey?.model, undefined, playerBey?.modelMeta),
    preloadTopModel(aiBey?.model, undefined, aiBey?.modelMeta),
  ]);
}
