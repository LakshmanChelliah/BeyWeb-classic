/**
 * Boot / start-screen grey Pegasus icon.
 *
 * Prefers rendering a desaturated storm_pegasus.glb into a shared WebGL
 * render target (avoids a second context on iOS). Falls back to the static
 * logo PNG if the GLB or GPU path fails. `preloadGreyPegasusIcon` starts the
 * load as early as the entry modules import.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { logoUrl, modelUrl } from '../assets.js';
import { prepareTopModelHolder } from '../render/modelCache.js';

const MODEL_URL = modelUrl('storm_pegasus.glb');
const LOGO_URL = logoUrl('pegasusLogo.png');
/** Slow analysis spin - positive Y matches in-game Pegasus right-spin (spinSign +1). */
const SPIN_RAD_PER_SEC = 0.55;
const ICON_CSS_PX = 120;
const RT_SIZE = 384;

const GREY_BODY = new THREE.Color(0xb0b8c2);
const GREY_METAL = new THREE.Color(0x8e96a0);
const GREY_ACCENT = new THREE.Color(0x5a616c);

const gltfLoader = new GLTFLoader();

/** Shared grey Pegasus template so boot + start icons load the GLB once. */
let _greyTemplate = null;
let _greyTemplatePromise = null;

function applyGreyAnalysisMaterials(root) {
  root.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = false;
    child.receiveShadow = false;
    child.frustumCulled = false;
    const mats = Array.isArray(child.material) ? child.material : [child.material];
    const next = mats.map((mat) => {
      if (!mat) return mat;
      const name = (mat.name || '').toLowerCase();
      const wasMetal =
        name.includes('045') ||
        name.includes('metal') ||
        (typeof mat.metalness === 'number' && mat.metalness >= 0.3);

      let color = wasMetal ? GREY_METAL : GREY_BODY;
      if (mat.color) {
        const lum = mat.color.r * 0.2126 + mat.color.g * 0.7152 + mat.color.b * 0.0722;
        if (lum < 0.12) color = GREY_ACCENT;
        else if (lum > 0.75) color = GREY_BODY;
      }

      // Low metalness - high metal without env map reads black on mobile GPUs.
      return new THREE.MeshStandardMaterial({
        color: color.clone(),
        metalness: 0.1,
        roughness: wasMetal ? 0.42 : 0.55,
        envMapIntensity: 0,
        name: mat.name || 'bey-icon-grey',
      });
    });
    child.material = Array.isArray(child.material) ? next : next[0];
  });
}

function loadGreyPegasusTemplate() {
  if (_greyTemplate) return Promise.resolve(_greyTemplate);
  if (_greyTemplatePromise) return _greyTemplatePromise;

  const modelUrl = new URL(MODEL_URL, window.location.href).href;
  _greyTemplatePromise = new Promise((resolve, reject) => {
    gltfLoader.load(
      modelUrl,
      (gltf) => {
        try {
          const holder = prepareTopModelHolder(gltf, MODEL_URL);
          applyGreyAnalysisMaterials(holder);
          _greyTemplate = holder;
          resolve(holder);
        } catch (err) {
          reject(err);
        }
      },
      undefined,
      (err) => reject(err || new Error('Failed to load storm_pegasus.glb'))
    );
  }).finally(() => {
    _greyTemplatePromise = null;
  });

  return _greyTemplatePromise;
}

function frameCameraToModel(root, camera) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  if (box.isEmpty()) return false;

  const center = box.getCenter(new THREE.Vector3());
  root.position.x -= center.x;
  root.position.y -= center.y;
  root.position.z -= center.z;
  root.updateMatrixWorld(true);

  const fitted = new THREE.Box3().setFromObject(root);
  const sphere = fitted.getBoundingSphere(new THREE.Sphere());
  // Use horizontal disc radius so the face fills the circular icon.
  const size = fitted.getSize(new THREE.Vector3());
  const discR = Math.max(size.x, size.z, sphere.radius, 0.25) * 0.5;

  const fov = THREE.MathUtils.degToRad(camera.fov);
  // Fill ~80% of the viewport with the disc.
  const dist = (discR * 1.15) / Math.tan(fov * 0.5);

  camera.position.set(0, dist * 0.82, dist * 0.55);
  camera.near = Math.max(0.01, dist / 250);
  camera.far = Math.max(80, dist * 40);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  return true;
}

function showFallbackStatic(containerEl, canvas) {
  containerEl.classList.add('bey-icon--fallback');
  canvas?.remove();
  // Keep or restore a static logo so the slot is never empty.
  if (!containerEl.querySelector('.bey-icon-placeholder')) {
    const img = document.createElement('img');
    img.className = 'bey-icon-placeholder';
    img.src = new URL(LOGO_URL, window.location.href).href;
    img.alt = '';
    img.decoding = 'async';
    containerEl.appendChild(img);
  }
}

function resolveWatchEl(containerEl, overlayEl) {
  if (overlayEl) return overlayEl;
  return (
    containerEl.closest('#boot-overlay') ||
    containerEl.closest('#start-overlay') ||
    containerEl
  );
}

/** Kick off the grey Pegasus GLB load as early as possible (deduped). */
export function preloadGreyPegasusIcon() {
  return loadGreyPegasusTemplate().catch(() => null);
}

/**
 * Mount a slowly spinning grey Storm Pegasus (storm_pegasus.glb) into a container.
 *
 * Uses the shared game WebGLRenderer via a render target when available so iOS
 * Safari does not lose a second WebGL context. Falls back to a dedicated
 * renderer when no shared one is provided.
 *
 * Keeps any existing `.bey-icon-placeholder` image until the first 3D frame
 * is painted so the boot screen never shows an empty glow.
 *
 * @param {HTMLElement | null} containerEl
 * @param {{ overlayEl?: HTMLElement | null, getRenderer?: () => import('three').WebGLRenderer | null }} [opts]
 */
export function mountBeyIcon(containerEl, { overlayEl = null, getRenderer = null } = {}) {
  if (!containerEl) return null;

  containerEl.classList.add('bey-icon');
  containerEl.classList.remove('is-ready', 'bey-icon--fallback');

  // Preserve an existing HTML placeholder; only clear previous canvas mounts.
  containerEl.querySelectorAll('canvas.bey-icon-canvas').forEach((el) => el.remove());
  let placeholder = containerEl.querySelector('.bey-icon-placeholder');
  if (!placeholder) {
    placeholder = document.createElement('img');
    placeholder.className = 'bey-icon-placeholder';
    placeholder.src = new URL(LOGO_URL, window.location.href).href;
    placeholder.alt = '';
    placeholder.decoding = 'async';
    placeholder.setAttribute('aria-hidden', 'true');
    containerEl.appendChild(placeholder);
  }

  const canvas = document.createElement('canvas');
  canvas.className = 'bey-icon-canvas';
  canvas.width = RT_SIZE;
  canvas.height = RT_SIZE;
  canvas.setAttribute('aria-hidden', 'true');
  // Sit under the placeholder until the first frame is ready.
  canvas.style.opacity = '0';
  containerEl.appendChild(canvas);
  const ctx2d = canvas.getContext('2d');

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
  camera.position.set(0, 4, 2);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.95));
  scene.add(new THREE.HemisphereLight(0xffffff, 0x2a3344, 0.85));
  const key = new THREE.DirectionalLight(0xffffff, 1.55);
  key.position.set(2.8, 6.5, 2.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xb8c4d4, 0.75);
  fill.position.set(-3.5, 2.8, -1.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe8eef8, 0.7);
  rim.position.set(0.4, 2.8, -3.8);
  scene.add(rim);

  const pivot = new THREE.Group();
  scene.add(pivot);

  let disposed = false;
  let active = true;
  let raf = 0;
  let lastTs = 0;
  let modelReady = false;
  let ownRenderer = null;
  let renderTarget = null;
  let pixelBuf = null;
  let imageData = null;

  const watchEl = resolveWatchEl(containerEl, overlayEl);
  let overlayVisible = !watchEl.classList.contains('hidden');

  function ensureOwnRenderer() {
    if (ownRenderer) return ownRenderer;
    try {
      ownRenderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'low-power',
        preserveDrawingBuffer: true,
        failIfMajorPerformanceCaveat: false,
      });
      ownRenderer.setClearColor(0x000000, 0);
      ownRenderer.outputColorSpace = THREE.SRGBColorSpace;
      ownRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      ownRenderer.toneMappingExposure = 1.15;
      ownRenderer.setSize(RT_SIZE, RT_SIZE, false);
      ownRenderer.setPixelRatio(1);
    } catch {
      ownRenderer = null;
    }
    return ownRenderer;
  }

  function ensureRenderTarget(renderer) {
    if (renderTarget) return renderTarget;
    renderTarget = new THREE.WebGLRenderTarget(RT_SIZE, RT_SIZE, {
      type: THREE.UnsignedByteType,
      format: THREE.RGBAFormat,
      colorSpace: THREE.SRGBColorSpace,
    });
    pixelBuf = new Uint8Array(RT_SIZE * RT_SIZE * 4);
    imageData = ctx2d.createImageData(RT_SIZE, RT_SIZE);
    return renderTarget;
  }

  function revealCanvas() {
    if (canvas.style.opacity === '1') return;
    canvas.style.opacity = '1';
    containerEl.classList.add('is-ready');
    placeholder?.remove();
    placeholder = null;
  }

  function blitToCanvas(renderer) {
    if (!ctx2d || !pixelBuf || !imageData || !renderTarget) return false;
    renderer.readRenderTargetPixels(renderTarget, 0, 0, RT_SIZE, RT_SIZE, pixelBuf);
    // WebGL is bottom-up; flip for 2D canvas.
    const row = RT_SIZE * 4;
    for (let y = 0; y < RT_SIZE; y++) {
      const src = (RT_SIZE - 1 - y) * row;
      imageData.data.set(pixelBuf.subarray(src, src + row), y * row);
    }
    ctx2d.putImageData(imageData, 0, 0);
    return true;
  }

  function renderIconFrame() {
    const shared = typeof getRenderer === 'function' ? getRenderer() : null;
    const renderer = shared || ensureOwnRenderer();
    if (!renderer) return false;

    const prevTarget = renderer.getRenderTarget();
    const prevXr = renderer.xr?.enabled;
    if (renderer.xr) renderer.xr.enabled = false;

    const rt = ensureRenderTarget(renderer);
    const prevTone = renderer.toneMappingExposure;
    const prevClearAlpha = renderer.getClearAlpha();
    const prevClearColor = new THREE.Color();
    renderer.getClearColor(prevClearColor);

    renderer.toneMappingExposure = 1.15;
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    const ok = blitToCanvas(renderer);

    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(prevClearColor, prevClearAlpha);
    renderer.toneMappingExposure = prevTone;
    if (renderer.xr) renderer.xr.enabled = prevXr;
    if (ok) revealCanvas();
    return ok;
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
    try {
      renderIconFrame();
    } catch {
      // Shared renderer may be mid-frame; skip this tick.
    }
  }

  function setActive(next) {
    active = Boolean(next);
    if (active) lastTs = 0;
  }

  raf = requestAnimationFrame(tick);

  const mo = typeof MutationObserver !== 'undefined'
    ? new MutationObserver(() => {
        if (disposed) return;
        if (syncOverlayVisible() && modelReady) {
          try {
            renderIconFrame();
          } catch {
            /* ignore */
          }
        }
      })
    : null;
  mo?.observe(watchEl, { attributes: true, attributeFilter: ['class'] });

  loadGreyPegasusTemplate()
    .then((template) => {
      if (disposed) return;
      if (!template) {
        showFallbackStatic(containerEl, canvas);
        return;
      }
      const instance = template.clone(true);
      // Clone shares materials with the template; re-clone materials so instances stay independent.
      instance.traverse((child) => {
        if (!child.isMesh) return;
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        const next = mats.map((m) => (m ? m.clone() : m));
        child.material = Array.isArray(child.material) ? next : next[0];
      });
      pivot.clear();
      pivot.add(instance);
      if (!frameCameraToModel(instance, camera)) {
        showFallbackStatic(containerEl, canvas);
        return;
      }
      modelReady = true;
      syncOverlayVisible();
      if (overlayVisible) renderIconFrame();
    })
    .catch(() => {
      if (!disposed) showFallbackStatic(containerEl, canvas);
    });

  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    mo?.disconnect();
    pivot.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) m?.dispose?.();
    });
    pivot.clear();
    renderTarget?.dispose();
    ownRenderer?.dispose();
    containerEl.replaceChildren();
  }

  return { dispose, setActive };
}
