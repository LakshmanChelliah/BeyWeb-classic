import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { applySteerForce } from '../physics/steer.js';

/** Boost mid-range tilt force without raising the full-tilt cap (avoids twitchy micro-tilts). */
function mediumTiltCurve(magnitude) {
  const m = Math.min(1, Math.max(0, magnitude));
  return m * (1 + 0.2 * (1 - m));
}

function needsIosMotionPermission() {
  return (
    (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') ||
    (typeof DeviceMotionEvent !== 'undefined' &&
      typeof DeviceMotionEvent.requestPermission === 'function')
  );
}

/**
 * Ask iOS for motion/orientation access.
 * MUST be called as the first await inside a real user-gesture handler
 * (tap/click). Any prior await or screen.orientation.lock() burns the
 * transient activation and Safari will not show the prompt.
 */
async function requestSensorPermission(EventCtor) {
  if (
    typeof EventCtor === 'undefined' ||
    typeof EventCtor.requestPermission !== 'function'
  ) {
    return { ok: true, state: 'not-required' };
  }
  try {
    const state = await EventCtor.requestPermission();
    return { ok: state === 'granted', state: String(state) };
  } catch (err) {
    return {
      ok: false,
      state: 'error',
      error: err?.name || 'Error',
      message: err?.message || String(err),
    };
  }
}

export function createGyroInput(canvas) {
  let calibBeta = 0;
  let calibGamma = 0;
  let rawBeta = 0;
  let rawGamma = 0;
  let hasOrientation = false;
  let gyroBeta = 0;
  let gyroGamma = 0;
  let usingMouse = false;
  let mouseSteerX = 0;
  let mouseSteerZ = 0;
  let listening = false;

  function onDeviceOrientation(event) {
    if (event.beta == null || event.gamma == null) return;
    rawBeta = event.beta;
    rawGamma = event.gamma;
    hasOrientation = true;
    usingMouse = false;
    gyroBeta = event.beta - calibBeta;
    gyroGamma = event.gamma - calibGamma;
  }

  async function requestMotionPermission() {
    // Non-iOS browsers: orientation events work without a prompt.
    if (!needsIosMotionPermission()) {
      return { granted: true, reason: 'not-required' };
    }

    // Request BOTH APIs when present — some iOS builds gate orientation
    // behind the motion permission dialog (and vice versa).
    // Call them back-to-back without intervening awaits that aren't the
    // permission call itself; Safari still treats the second as part of
    // the same gesture while the first prompt is resolving.
    const orientation = await requestSensorPermission(DeviceOrientationEvent);
    const motion = await requestSensorPermission(DeviceMotionEvent);

    const granted = orientation.ok || motion.ok;
    return {
      granted,
      reason: granted ? 'granted' : 'denied',
      orientation,
      motion,
    };
  }

  function calibrateGyro(event) {
    calibBeta = event.beta || 0;
    calibGamma = event.gamma || 0;
    gyroBeta = 0;
    gyroGamma = 0;
  }

  function calibrateNow() {
    if (!hasOrientation) return false;
    calibrateGyro({ beta: rawBeta, gamma: rawGamma });
    return true;
  }

  async function calibrateOnce() {
    if (calibrateNow()) return true;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (ok) => {
        if (settled) return;
        settled = true;
        window.removeEventListener('deviceorientation', handler, true);
        resolve(ok);
      };
      const handler = (e) => {
        if (e.beta == null || e.gamma == null) return;
        calibrateGyro(e);
        hasOrientation = true;
        rawBeta = e.beta || 0;
        rawGamma = e.gamma || 0;
        finish(true);
      };
      window.addEventListener('deviceorientation', handler, true);
      // Give sensors a moment after permission grant before giving up.
      setTimeout(() => finish(hasOrientation), 800);
    });
  }

  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') {
      usingMouse = true;
    }
    const rect = canvas.getBoundingClientRect();
    const nx = rect.width > 0 ? ((e.clientX - rect.left) / rect.width) * 2 - 1 : 0;
    const ny = rect.height > 0 ? ((e.clientY - rect.top) / rect.height) * 2 - 1 : 0;
    mouseSteerX = nx * CONFIG.GYRO_CLAMP;
    mouseSteerZ = ny * CONFIG.GYRO_CLAMP;
  });

  function startListening() {
    if (listening) return;
    listening = true;
    window.addEventListener('deviceorientation', onDeviceOrientation, true);
  }

  function applyGyroSteer(body, spin) {
    let tiltX;
    let tiltZ;
    // Pointer fallback when no orientation sensor (desktop) or explicit mouse mode.
    if (usingMouse || !hasOrientation) {
      tiltX = mouseSteerX;
      tiltZ = mouseSteerZ;
    } else {
      tiltX = THREE.MathUtils.clamp(gyroGamma, -CONFIG.GYRO_CLAMP, CONFIG.GYRO_CLAMP);
      tiltZ = THREE.MathUtils.clamp(gyroBeta, -CONFIG.GYRO_CLAMP, CONFIG.GYRO_CLAMP);
    }

    const normX = tiltX / CONFIG.GYRO_CLAMP;
    const normZ = tiltZ / CONFIG.GYRO_CLAMP;
    const mag = Math.hypot(normX, normZ);
    if (mag < 1e-4) return;
    const scale = mediumTiltCurve(mag) / mag;

    applySteerForce(
      body,
      normX * scale,
      normZ * scale,
      spin,
      CONFIG.GYRO_FORCE,
      { minSpin: CONFIG.SLEEP_THRESHOLD, normalize: false }
    );
  }

  return {
    needsIosMotionPermission,
    requestMotionPermission,
    calibrateOnce,
    calibrateNow,
    startListening,
    applyGyroSteer,
    hasOrientation: () => hasOrientation,
    setMouseFallback() {
      usingMouse = true;
    },
    clearMouseFallback() {
      usingMouse = false;
    },
  };
}
