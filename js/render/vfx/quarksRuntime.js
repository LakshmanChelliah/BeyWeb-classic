/**
 * Shared three.quarks BatchedRenderer for ability VFX.
 * One renderer per scene; emitters register themselves and update each frame.
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
const _systems = new Set();

export function ensureQuarksRuntime(scene) {
  if (_renderer && _scene === scene) return _renderer;
  _scene = scene;
  _renderer = new BatchedRenderer();
  _renderer.name = 'quarksBatchedRenderer';
  scene.add(_renderer);
  return _renderer;
}

export function updateQuarks(dt) {
  if (_renderer) _renderer.update(dt);
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

/**
 * One-shot burst particle system. Call burst() to fire.
 */
export function createBurstSystem(scene, opts = {}) {
  const renderer = ensureQuarksRuntime(scene);
  const {
    duration = 0.55,
    startLife = [0.25, 0.55],
    startSpeed = [2, 8],
    startSize = [0.12, 0.45],
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
}

/**
 * Continuous trail emitter that follows a moving point.
 */
export function createTrailSystem(scene, opts = {}) {
  const renderer = ensureQuarksRuntime(scene);
  const {
    startLife = [0.18, 0.4],
    startSpeed = [0.2, 1.2],
    startSize = [0.2, 0.55],
    colorA = new Vector4(0.45, 0.75, 1, 0.9),
    colorB = new Vector4(0.85, 0.95, 1, 0),
    rate = 40,
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
}

export { Vector4, ConstantValue, IntervalValue };
