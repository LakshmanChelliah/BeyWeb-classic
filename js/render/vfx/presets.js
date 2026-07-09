/**
 * Reusable three.quarks emitter presets for ability VFX.
 * Thin wrappers over quarksRuntime — trails, bursts, debris, wind, sand,
 * lightning sparks, and impact shockwaves as particle bursts (not rings).
 */
import {
  createBurstSystem,
  createTrailSystem,
  Vector4,
} from './quarksRuntime.js';

/** Soft afterimage / speed-line trail (Pegasus, Striker dash). */
export function createSpeedTrail(scene, {
  rate = 70,
  tint = 'blue',
} = {}) {
  const palettes = {
    blue: {
      colorA: new Vector4(0.45, 0.78, 1, 0.95),
      colorB: new Vector4(0.9, 0.97, 1, 0),
    },
    purple: {
      colorA: new Vector4(0.72, 0.45, 1, 0.95),
      colorB: new Vector4(0.95, 0.85, 1, 0),
    },
    teal: {
      colorA: new Vector4(0.2, 0.95, 0.85, 0.95),
      colorB: new Vector4(0.75, 1, 0.95, 0),
    },
    green: {
      colorA: new Vector4(0.45, 0.95, 0.55, 0.95),
      colorB: new Vector4(0.85, 1, 0.9, 0),
    },
    amber: {
      colorA: new Vector4(0.98, 0.8, 0.25, 0.95),
      colorB: new Vector4(0.95, 0.5, 0.1, 0),
    },
    crimson: {
      colorA: new Vector4(0.95, 0.35, 0.2, 0.95),
      colorB: new Vector4(0.55, 0.12, 0.08, 0),
    },
  };
  const p = palettes[tint] || palettes.blue;
  return createTrailSystem(scene, {
    rate,
    startSize: [0.18, 0.55],
    startLife: [0.18, 0.42],
    ...p,
  });
}

/** Ground debris / dirt geyser (Bull dig, bounce hops). */
export function createDebrisBurst(scene, {
  dustyColor = 0xc4a574,
  hot = false,
} = {}) {
  return createBurstSystem(scene, {
    additive: false,
    dustyColor,
    startSpeed: hot ? [7, 18] : [4, 12],
    startSize: hot ? [0.25, 0.9] : [0.2, 0.65],
    gravity: hot ? -18 : -14,
    coneAngle: hot ? 1.3 : 1.15,
    colorA: hot
      ? new Vector4(0.95, 0.5, 0.15, 1)
      : new Vector4(0.9, 0.82, 0.65, 0.95),
    colorB: hot
      ? new Vector4(0.45, 0.2, 0.08, 0)
      : new Vector4(0.55, 0.48, 0.35, 0),
  });
}

/** Additive spark / lightning burst (impacts, special clashes). */
export function createSparkBurst(scene, {
  tint = 'white',
} = {}) {
  const palettes = {
    white: {
      colorA: new Vector4(1, 1, 1, 1),
      colorB: new Vector4(0.7, 0.85, 1, 0),
    },
    purple: {
      colorA: new Vector4(0.95, 0.85, 1, 1),
      colorB: new Vector4(0.55, 0.3, 0.95, 0),
    },
    blue: {
      colorA: new Vector4(0.8, 0.95, 1, 1),
      colorB: new Vector4(0.4, 0.75, 1, 0),
    },
    green: {
      colorA: new Vector4(0.75, 1, 0.7, 1),
      colorB: new Vector4(0.25, 0.85, 0.4, 0),
    },
    teal: {
      colorA: new Vector4(0.25, 1, 0.9, 1),
      colorB: new Vector4(0.85, 1, 0.98, 0),
    },
    red: {
      colorA: new Vector4(1, 0.55, 0.25, 1),
      colorB: new Vector4(0.9, 0.2, 0.1, 0),
    },
  };
  const p = palettes[tint] || palettes.white;
  return createBurstSystem(scene, {
    additive: true,
    startSpeed: [6, 18],
    startSize: [0.1, 0.4],
    gravity: -4,
    ...p,
  });
}

/** Expanding impact shockwave as a short particle burst (not a RingGeometry). */
export function createImpactShockwave(scene, {
  tint = 'white',
} = {}) {
  const palettes = {
    white: {
      colorA: new Vector4(1, 1, 1, 0.95),
      colorB: new Vector4(0.8, 0.9, 1, 0),
    },
    purple: {
      colorA: new Vector4(0.85, 0.7, 1, 0.95),
      colorB: new Vector4(0.45, 0.2, 0.8, 0),
    },
    green: {
      colorA: new Vector4(0.6, 1, 0.65, 0.95),
      colorB: new Vector4(0.2, 0.7, 0.35, 0),
    },
    sand: {
      colorA: new Vector4(0.95, 0.85, 0.55, 0.95),
      colorB: new Vector4(0.55, 0.42, 0.25, 0),
    },
  };
  const p = palettes[tint] || palettes.white;
  return createBurstSystem(scene, {
    additive: true,
    startSpeed: [10, 26],
    startSize: [0.2, 0.7],
    gravity: -1,
    coneAngle: 1.55,
    duration: 0.45,
    startLife: [0.2, 0.4],
    ...p,
  });
}

/** Wind / gale debris orbit trail (Leone wall volume). */
export function createWindDebris(scene) {
  return createTrailSystem(scene, {
    rate: 40,
    startSize: [0.2, 0.65],
    startLife: [0.35, 0.7],
    gravity: -6,
    colorA: new Vector4(0.55, 0.85, 0.45, 0.85),
    colorB: new Vector4(0.25, 0.45, 0.2, 0),
  });
}

/** Sandstorm grit trail (Libra Sonic Buster). */
export function createSandStorm(scene) {
  return createTrailSystem(scene, {
    rate: 65,
    startSize: [0.22, 0.7],
    startLife: [0.35, 0.75],
    gravity: -4,
    colorA: new Vector4(0.92, 0.78, 0.45, 0.9),
    colorB: new Vector4(0.55, 0.42, 0.22, 0),
  });
}

/** Dark-energy vortex trail (L-Drago Soaring Destruction). */
export function createDarkVortexTrail(scene) {
  return createTrailSystem(scene, {
    rate: 70,
    startSize: [0.25, 0.7],
    startLife: [0.25, 0.55],
    gravity: -1,
    colorA: new Vector4(0.55, 0.2, 0.85, 0.95),
    colorB: new Vector4(0.2, 0.05, 0.4, 0),
  });
}

/** Green-ray vanish pop (Striker anime teleport). */
export function createGreenRayBurst(scene) {
  return createBurstSystem(scene, {
    additive: true,
    startSpeed: [8, 22],
    startSize: [0.08, 0.35],
    gravity: -1,
    coneAngle: 1.5,
    colorA: new Vector4(0.45, 1, 0.55, 1),
    colorB: new Vector4(0.85, 1, 0.9, 0),
  });
}

/** Purple wind sheath trail (Eagle Diving Crush canon glow). */
export function createPurpleWindTrail(scene) {
  return createTrailSystem(scene, {
    rate: 75,
    startSize: [0.18, 0.55],
    startLife: [0.25, 0.55],
    gravity: -2,
    colorA: new Vector4(0.75, 0.45, 1, 0.95),
    colorB: new Vector4(0.45, 0.2, 0.85, 0),
  });
}
