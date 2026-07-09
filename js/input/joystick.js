import { CONFIG } from '../config.js';
import { applySteerForce } from '../physics/steer.js';

/** Match gyro mid-range response so stick and tilt feel similar. */
function mediumTiltCurve(magnitude) {
  const m = Math.min(1, Math.max(0, magnitude));
  return m * (1 + 0.2 * (1 - m));
}

const DEADZONE = 0.08;

/**
 * On-screen virtual joystick for mobile steering (bottom-center).
 * @param {HTMLElement} rootEl
 */
export function createJoystickInput(rootEl) {
  let active = false;
  let pointerId = null;
  let steerX = 0;
  let steerZ = 0;
  let maxRadius = 34;

  rootEl.innerHTML = `
    <div class="virtual-joystick-base"></div>
    <div class="virtual-joystick-knob"></div>
  `;

  const knob = rootEl.querySelector('.virtual-joystick-knob');

  function updateMaxRadius() {
    const half = rootEl.clientWidth / 2;
    const knobHalf = (knob?.offsetWidth || 52) / 2;
    maxRadius = Math.max(20, half - knobHalf);
  }

  function setKnob(nx, nz) {
    if (!knob) return;
    knob.style.transform = `translate(${nx * maxRadius}px, ${nz * maxRadius}px)`;
  }

  function resetStick() {
    steerX = 0;
    steerZ = 0;
    pointerId = null;
    setKnob(0, 0);
  }

  function readOffset(clientX, clientY) {
    const rect = rootEl.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    let dx = clientX - cx;
    let dy = clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > maxRadius && len > 0) {
      dx = (dx / len) * maxRadius;
      dy = (dy / len) * maxRadius;
    }
    const nx = maxRadius > 0 ? dx / maxRadius : 0;
    const nz = maxRadius > 0 ? dy / maxRadius : 0;
    return { nx, nz };
  }

  function onPointerDown(e) {
    if (!active || pointerId != null) return;
    e.preventDefault();
    pointerId = e.pointerId;
    rootEl.setPointerCapture?.(e.pointerId);
    updateMaxRadius();
    const { nx, nz } = readOffset(e.clientX, e.clientY);
    steerX = nx;
    steerZ = nz;
    setKnob(nx, nz);
  }

  function onPointerMove(e) {
    if (!active || e.pointerId !== pointerId) return;
    e.preventDefault();
    const { nx, nz } = readOffset(e.clientX, e.clientY);
    steerX = nx;
    steerZ = nz;
    setKnob(nx, nz);
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId) return;
    e.preventDefault();
    try {
      rootEl.releasePointerCapture?.(e.pointerId);
    } catch {
      /* already released */
    }
    resetStick();
  }

  rootEl.addEventListener('pointerdown', onPointerDown);
  rootEl.addEventListener('pointermove', onPointerMove);
  rootEl.addEventListener('pointerup', onPointerUp);
  rootEl.addEventListener('pointercancel', onPointerUp);

  function show() {
    active = true;
    rootEl.classList.remove('hidden');
    rootEl.setAttribute('aria-hidden', 'false');
    document.body.classList.add('joystick-mode');
    resetStick();
    requestAnimationFrame(updateMaxRadius);
  }

  function hide() {
    active = false;
    rootEl.classList.add('hidden');
    rootEl.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('joystick-mode');
    resetStick();
  }

  function reset() {
    resetStick();
  }

  function applyJoystickSteer(body, spin) {
    if (!active) return;
    const mag = Math.hypot(steerX, steerZ);
    if (mag < DEADZONE) return;
    const scale = mediumTiltCurve(mag) / mag;
    applySteerForce(
      body,
      steerX * scale,
      steerZ * scale,
      spin,
      CONFIG.GYRO_FORCE,
      { minSpin: CONFIG.SLEEP_THRESHOLD, normalize: false }
    );
  }

  return {
    show,
    hide,
    reset,
    applyJoystickSteer,
    isActive() {
      return active;
    },
  };
}
