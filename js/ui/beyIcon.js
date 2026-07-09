import * as THREE from 'three';
import { preloadTopModel, cloneTopModel } from '../render/modelCache.js';

const MODEL_URL = 'storm_pegasus.glb';
/** Slow analysis spin — positive Y matches in-game Pegasus right-spin (spinSign +1). */
const SPIN_RAD_PER_SEC = 0.6;
const ICON_SIZE = 112;
const GREY_BODY = new THREE.Color(0x9aa3ad);
const GREY_METAL = new THREE.Color(0x6e7680);

/**
 * Recolor a cloned top for the monochrome “visual analysis” icon.
 * Mutates only this instance’s materials (cloned first).
 */
function applyGreyAnalysisMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => {
      if (!mat) return mat;
      const m = mat.clone();
      const name = (m.name || '').toLowerCase();
      const isMetal =
        name.includes('045') ||
        name.includes('metal') ||
        (typeof m.metalness === 'number' && m.metalness >= 0.7);

      m.color?.copy(isMetal ? GREY_METAL : GREY_BODY);
      if (m.map) {
        m.map = null;
      }
      if (m.emissive) {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
      if ('metalness' in m) m.metalness = isMetal ? 0.55 : 0.38;
      if ('roughness' in m) m.roughness = isMetal ? 0.42 : 0.55;
      if (m.transparent || m.opacity < 1) {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
      }
      m.needsUpdate = true;
      return m;
    });
    child.material = Array.isArray(child.material) ? next : next[0];
  });
}

function fitModelInView(model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  const maxDim = Math.max(size.x, size.y, size.z, 0.001);
  const scale = 1.15 / maxDim;
  model.scale.multiplyScalar(scale);
}

/**
 * Mount a slowly spinning grey Storm Pegasus preview into a container.
 * Renders only while the start overlay (or container) is visible.
 * @param {HTMLElement | null} containerEl
 * @param {{ overlayEl?: HTMLElement | null }} [opts]
 * @returns {{ dispose: () => void, setActive: (active: boolean) => void } | null}
 */
export function mountBeyIcon(containerEl, { overlayEl = null } = {}) {
  if (!containerEl) return null;

  containerEl.classList.add('bey-icon');
  containerEl.replaceChildren();

  const canvas = document.createElement('canvas');
  canvas.className = 'bey-icon-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  containerEl.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'low-power',
  });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 20);
  // Look down the spin axis (+Y = up) with a slight pitch so the disc reads in 3D.
  camera.position.set(0, 2.35, 0.95);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xc8d0dc, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.35);
  key.position.set(2.2, 4, 1.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xa8b4c8, 0.55);
  fill.position.set(-2, 1.5, -1.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xd0d6e0, 0.4);
  rim.position.set(0, 1.2, -2.5);
  scene.add(rim);

  const pivot = new THREE.Group();
  scene.add(pivot);

  let disposed = false;
  let active = true;
  let raf = 0;
  let lastTs = 0;
  let modelReady = false;
  const watchEl = overlayEl || containerEl.closest('#start-overlay') || containerEl;
  let overlayVisible = !watchEl.classList.contains('hidden');

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const size = containerEl.clientWidth || ICON_SIZE;
    renderer.setPixelRatio(dpr);
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }

  function syncOverlayVisible() {
    const was = overlayVisible;
    overlayVisible = watchEl.isConnected && !watchEl.classList.contains('hidden');
    if (overlayVisible && !was) lastTs = 0;
    return overlayVisible;
  }

  function tick(ts) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    if (!active || !modelReady || !overlayVisible) {
      lastTs = ts;
      return;
    }
    const dt = lastTs ? Math.min(0.05, (ts - lastTs) / 1000) : 0;
    lastTs = ts;
    // Positive Y = same direction as in-game Pegasus (right-spin / spinSign +1).
    pivot.rotation.y += SPIN_RAD_PER_SEC * dt;
    renderer.render(scene, camera);
  }

  function setActive(next) {
    active = Boolean(next);
    if (active) lastTs = 0;
  }

  function showFallback() {
    containerEl.classList.add('bey-icon--fallback');
    canvas.remove();
  }

  resize();
  raf = requestAnimationFrame(tick);

  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => {
        if (!disposed) resize();
      })
    : null;
  ro?.observe(containerEl);

  const mo = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(() => {
        if (disposed) return;
        if (syncOverlayVisible() && modelReady) {
          renderer.render(scene, camera);
        }
      })
    : null;
  mo?.observe(watchEl, { attributes: true, attributeFilter: ['class'] });

  preloadTopModel(MODEL_URL)
    .then((template) => {
      if (disposed) return;
      if (!template) {
        showFallback();
        return;
      }
      const instance = cloneTopModel(template);
      applyGreyAnalysisMaterials(instance);
      fitModelInView(instance);
      pivot.add(instance);
      modelReady = true;
      syncOverlayVisible();
      if (overlayVisible) renderer.render(scene, camera);
    })
    .catch(() => {
      if (!disposed) showFallback();
    });

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    ro?.disconnect();
    mo?.disconnect();
    pivot.clear();
    renderer.dispose();
    containerEl.replaceChildren();
  }

  return { dispose, setActive };
}
