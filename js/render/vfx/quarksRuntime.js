/**
 * Shared three.quarks BatchedRenderer for ability VFX.
 * One renderer per scene; emitters register themselves and update each frame.
 *
 * Init / emitter construction is fail-soft so a WebGL / quarks issue cannot
 * brick the boot screen (stuck at 0%).
 */
import * as THREE from 'three';
import {
  BatchedRenderer,
  ParticleSystem,
  IntervalValue,
  ConstantValue,
  ColorRange,
  Vector3,
  Vector4,
  ConeEmitter,
  SphereEmitter,
  SizeOverLife,
  ColorOverLife,
  ForceOverLife,
  PiecewiseBezier,
  Bezier,
  Gradient,
  RenderMode,
} from 'three.quarks';

let _renderer = null;
let _scene = null;
let _disabled = false;
const _systems = new Set();

/** Shared soft-circle textures — one GPU upload, reused by every emitter. */
let _softGlowTex = null;
let _softDustTex = null;

/**
 * Soft radial glow disc (additive sparks / trails).
 * Replaces default square quads with anime-readable orbs without extra draw calls.
 */
export function getSoftGlowTexture() {
  if (_softGlowTex) return _softGlowTex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,0.92)');
  g.addColorStop(0.55, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  _softGlowTex = new THREE.CanvasTexture(c);
  _softGlowTex.colorSpace = THREE.SRGBColorSpace;
  _softGlowTex.needsUpdate = true;
  return _softGlowTex;
}

/** Softer dusty disc for ground debris (normal blend). */
export function getSoftDustTexture() {
  if (_softDustTex) return _softDustTex;
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.18)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  _softDustTex = new THREE.CanvasTexture(c);
  _softDustTex.colorSpace = THREE.SRGBColorSpace;
  _softDustTex.needsUpdate = true;
  return _softDustTex;
}

export function ensureQuarksRuntime(scene) {
  if (_disabled) return null;
  if (_renderer && _scene === scene) return _renderer;
  if (!scene) return null;
  try {
    // Warm textures once so first special does not hitch on canvas upload.
    getSoftGlowTexture();
    getSoftDustTexture();
    _scene = scene;
    _renderer = new BatchedRenderer();
    _renderer.name = 'quarksBatchedRenderer';
    scene.add(_renderer);
    return _renderer;
  } catch (err) {
    console.warn('[quarks] BatchedRenderer init failed — particle VFX disabled', err);
    _disabled = true;
    _renderer = null;
    return null;
  }
}

export function updateQuarks(dt) {
  if (_renderer) {
    try {
      _renderer.update(dt);
    } catch (_) {
      /* ignore frame errors */
    }
  }
}

export function resetQuarksRuntime() {
  for (const sys of _systems) {
    try {
      sys.restart();
      sys.pause();
    } catch (_) {
      /* ignore */
    }
  }
}

function softParticleMat() {
  return new THREE.MeshBasicMaterial({
    map: getSoftGlowTexture(),
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

function dustyParticleMat(color = 0xc4a574) {
  return new THREE.MeshBasicMaterial({
    map: getSoftDustTexture(),
    color,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.DoubleSide,
  });
}

function makeGradient(colorA, colorB) {
  return new Gradient(
    [
      [new Vector3(colorA.x, colorA.y, colorA.z), 0],
      [new Vector3(colorB.x, colorB.y, colorB.z), 1],
    ],
    [
      [colorA.w, 0],
      [0, 1],
    ]
  );
}

function noopBurstSystem() {
  return {
    system: null,
    emitter: null,
    burst() {},
    setPosition() {},
    dispose() {},
  };
}

function noopTrailSystem() {
  return {
    system: null,
    emitter: null,
    follow() {},
    stop() {},
    dispose() {},
  };
}

/**
 * One-shot burst particle system. Call burst() to fire.
 */
export function createBurstSystem(scene, opts = {}) {
  const renderer = ensureQuarksRuntime(scene);
  if (!renderer) return noopBurstSystem();
  try {
    const {
      duration = 0.55,
      startLife = [0.28, 0.62],
      startSpeed = [2.5, 9],
      startSize = [0.18, 0.55],
      colorA = new Vector4(1, 1, 1, 1),
      colorB = new Vector4(0.6, 0.8, 1, 0.15),
      additive = true,
      coneAngle = 0.95,
      gravity = -8,
      worldSpace = true,
      dustyColor = 0xc4a574,
    } = opts;

    const mat = additive ? softParticleMat() : dustyParticleMat(dustyColor);
    const system = new ParticleSystem({
      duration,
      looping: false,
      prewarm: false,
      startLife: new IntervalValue(startLife[0], startLife[1]),
      startSpeed: new IntervalValue(startSpeed[0], startSpeed[1]),
      startSize: new IntervalValue(startSize[0], startSize[1]),
      startColor: new ColorRange(colorA, colorB),
      worldSpace,
      emissionOverTime: new ConstantValue(0),
      emissionBursts: [
        {
          time: 0,
          count: new ConstantValue(24),
          cycle: 1,
          interval: 0.01,
          probability: 1,
        },
      ],
      shape: new ConeEmitter({ radius: 0.18, arc: Math.PI * 2, thickness: 1, angle: coneAngle }),
      material: mat,
      renderMode: RenderMode.BillBoard,
      startTileIndex: new ConstantValue(0),
      uTileCount: 1,
      vTileCount: 1,
      behaviors: [
        new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.85, 0.35, 0), 0]])),
        new ColorOverLife(makeGradient(colorA, colorB)),
        new ForceOverLife(
          new ConstantValue(0),
          new ConstantValue(gravity),
          new ConstantValue(0)
        ),
      ],
    });

    renderer.addSystem(system);
    scene.add(system.emitter);
    _systems.add(system);
    system.pause();

    return {
      system,
      emitter: system.emitter,
      burst(count = 24) {
        const n = Math.max(1, Math.floor(count));
        if (system.emissionBursts?.[0]) {
          system.emissionBursts[0].count = new ConstantValue(n);
        }
        system.restart();
        system.play();
      },
      setPosition(x, y, z) {
        system.emitter.position.set(x, y, z);
      },
      dispose() {
        try {
          renderer.deleteSystem(system);
        } catch (_) {
          /* ignore */
        }
        _systems.delete(system);
        scene.remove(system.emitter);
        mat.dispose();
      },
    };
  } catch (err) {
    console.warn('[quarks] createBurstSystem failed', err);
    return noopBurstSystem();
  }
}

/**
 * Continuous trail emitter that follows a moving point.
 */
export function createTrailSystem(scene, opts = {}) {
  const renderer = ensureQuarksRuntime(scene);
  if (!renderer) return noopTrailSystem();
  try {
    const {
      startLife = [0.22, 0.48],
      startSpeed = [0.25, 1.4],
      startSize = [0.28, 0.7],
      colorA = new Vector4(0.45, 0.75, 1, 0.9),
      colorB = new Vector4(0.85, 0.95, 1, 0),
      rate = 48,
      gravity = 0,
    } = opts;

    const mat = softParticleMat();
    const system = new ParticleSystem({
      duration: 1,
      looping: true,
      startLife: new IntervalValue(startLife[0], startLife[1]),
      startSpeed: new IntervalValue(startSpeed[0], startSpeed[1]),
      startSize: new IntervalValue(startSize[0], startSize[1]),
      startColor: new ColorRange(colorA, colorB),
      worldSpace: true,
      emissionOverTime: new ConstantValue(0),
      shape: new SphereEmitter({ radius: 0.2, thickness: 1, arc: Math.PI * 2 }),
      material: mat,
      renderMode: RenderMode.BillBoard,
      startTileIndex: new ConstantValue(0),
      uTileCount: 1,
      vTileCount: 1,
      behaviors: [
        new SizeOverLife(new PiecewiseBezier([[new Bezier(1, 0.7, 0.25, 0), 0]])),
        new ColorOverLife(makeGradient(colorA, colorB)),
        new ForceOverLife(new ConstantValue(0), new ConstantValue(gravity), new ConstantValue(0)),
      ],
    });

    renderer.addSystem(system);
    scene.add(system.emitter);
    _systems.add(system);
    system.pause();

    let active = false;
    return {
      system,
      emitter: system.emitter,
      follow(x, y, z, emit = true) {
        system.emitter.position.set(x, y, z);
        if (emit) {
          if (!active) {
            system.emissionOverTime = new ConstantValue(rate);
            system.restart();
            system.play();
            active = true;
          }
        } else if (active) {
          system.emissionOverTime = new ConstantValue(0);
          active = false;
        }
      },
      stop() {
        system.emissionOverTime = new ConstantValue(0);
        active = false;
      },
      dispose() {
        try {
          renderer.deleteSystem(system);
        } catch (_) {
          /* ignore */
        }
        _systems.delete(system);
        scene.remove(system.emitter);
        mat.dispose();
      },
    };
  } catch (err) {
    console.warn('[quarks] createTrailSystem failed', err);
    return noopTrailSystem();
  }
}

export { Vector4, ConstantValue, IntervalValue };
