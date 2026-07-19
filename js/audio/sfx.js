/**
 * Core-fight SFX: Web Audio buffers, unlock-on-gesture, simple cooldowns.
 * Assets live in assets/sfx/ (mp3 preferred for iOS, ogg fallback).
 */

const BASE = 'assets/sfx/';

/** @type {readonly string[]} */
export const SFX_IDS = Object.freeze([
  'launch_countdown_tick',
  'launch_rip_window',
  'launch_rip',
  'launch_grade_miss',
  'launch_grade_weak',
  'launch_grade_good',
  'launch_grade_great',
  'launch_grade_perfect',
  'launch_drop',
  'clash_light',
  'clash_heavy',
  'wall_hit',
  'ring_out',
  'sleep_out',
  'result_win',
  'result_lose',
  'result_draw',
]);

/** Closing speed at/above this plays the heavy clash. */
const CLASH_HEAVY_SPEED = 12;

/** @type {AudioContext | null} */
let ctx = null;
/** @type {Map<string, AudioBuffer>} */
const buffers = new Map();
/** @type {Map<string, number>} */
const lastPlayAt = new Map();
/** @type {Promise<void> | null} */
let loadPromise = null;
let muted = false;

function getCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  return ctx;
}

async function decodeUrl(audioCtx, url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sfx fetch ${url}: ${res.status}`);
  const raw = await res.arrayBuffer();
  return audioCtx.decodeAudioData(raw.slice(0));
}

async function loadOne(audioCtx, id) {
  if (buffers.has(id)) return buffers.get(id);
  try {
    const buf = await decodeUrl(audioCtx, `${BASE}${id}.mp3`);
    buffers.set(id, buf);
    return buf;
  } catch {
    const buf = await decodeUrl(audioCtx, `${BASE}${id}.ogg`);
    buffers.set(id, buf);
    return buf;
  }
}

/** Prefetch all core clips (safe to call before unlock). */
export function preloadSfx() {
  if (loadPromise) return loadPromise;
  const audioCtx = getCtx();
  if (!audioCtx) {
    loadPromise = Promise.resolve();
    return loadPromise;
  }
  loadPromise = Promise.all(
    SFX_IDS.map((id) =>
      loadOne(audioCtx, id).catch((err) => {
        console.warn('[sfx] failed to load', id, err);
      })
    )
  ).then(() => undefined);
  return loadPromise;
}

/** Resume AudioContext from a user gesture (call synchronously in the handler). */
export function unlockSfx() {
  const audioCtx = getCtx();
  if (!audioCtx) return;
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  void preloadSfx();
}

/**
 * @param {string} id
 * @param {{ volume?: number, rate?: number, cooldownMs?: number }} [opts]
 */
export function playSfx(id, opts = {}) {
  if (muted) return;
  const audioCtx = getCtx();
  if (!audioCtx) return;

  const cooldownMs = opts.cooldownMs ?? 0;
  if (cooldownMs > 0) {
    const now = performance.now();
    const prev = lastPlayAt.get(id) ?? 0;
    if (now - prev < cooldownMs) return;
    lastPlayAt.set(id, now);
  }

  const buffer = buffers.get(id);
  if (!buffer) {
    // Lazy load then play once ready (best-effort).
    void loadOne(audioCtx, id)
      .then(() => playSfx(id, { ...opts, cooldownMs: 0 }))
      .catch(() => {});
    return;
  }

  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }

  const src = audioCtx.createBufferSource();
  src.buffer = buffer;
  src.playbackRate.value = opts.rate ?? 1;
  const gain = audioCtx.createGain();
  gain.gain.value = opts.volume ?? 1;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  try {
    src.start(0);
  } catch {
    /* ignore double-start */
  }
}

export function playLaunchCountdownTick() {
  playSfx('launch_countdown_tick', { volume: 0.7, cooldownMs: 40 });
}

export function playLaunchRipWindow() {
  playSfx('launch_rip_window', { volume: 0.75 });
}

export function playLaunchRip() {
  playSfx('launch_rip', { volume: 0.85, cooldownMs: 80 });
}

/** @param {string} grade */
export function playLaunchGrade(grade) {
  const id = `launch_grade_${grade}`;
  if (!SFX_IDS.includes(id)) {
    playSfx('launch_grade_miss', { volume: 0.7 });
    return;
  }
  playSfx(id, { volume: 0.8 });
}

export function playLaunchDrop() {
  playSfx('launch_drop', { volume: 0.8, cooldownMs: 400 });
}

/** @param {number} closingSpeed */
export function playClash(closingSpeed) {
  const heavy = closingSpeed >= CLASH_HEAVY_SPEED;
  playSfx(heavy ? 'clash_heavy' : 'clash_light', {
    volume: heavy ? 0.95 : 0.7,
    cooldownMs: 70,
  });
}

export function playWallHit() {
  playSfx('wall_hit', { volume: 0.7, cooldownMs: 70 });
}

export function playRingOut() {
  playSfx('ring_out', { volume: 0.9 });
}

export function playSleepOut() {
  playSfx('sleep_out', { volume: 0.75, cooldownMs: 500 });
}

/**
 * @param {{ titleClass?: string, outcome?: string }} info
 */
export function playMatchResult(info) {
  const cls = info?.titleClass;
  if (cls === 'lose') {
    playSfx('result_lose', { volume: 0.85 });
    return;
  }
  if (cls === 'draw' || info?.outcome === 'DRAW') {
    playSfx('result_draw', { volume: 0.8 });
    return;
  }
  playSfx('result_win', { volume: 0.85 });
}

export function setSfxMuted(next) {
  muted = Boolean(next);
  try {
    localStorage.setItem('bey-sfx-muted', muted ? '1' : '0');
  } catch {
    /* ignore */
  }
}

export function isSfxMuted() {
  return muted;
}

try {
  muted = localStorage.getItem('bey-sfx-muted') === '1';
} catch {
  muted = false;
}
