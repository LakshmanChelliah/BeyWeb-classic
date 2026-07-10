import { createGyroInput } from './input/gyro.js';
import { createJoystickInput } from './input/joystick.js';
import { applyAISteering, tickAIAbilities } from './input/ai.js';
import { createAppBootstrap } from './app/bootstrap.js?v=56';
import { modeBlurb } from './game/modes.js';
import { installTouchZoomGuard } from './touchZoomGuard.js';
import { preloadGreyPegasusIcon } from './ui/beyIcon.js';

// Kick off the boot icon GLB before the rest of app bootstrap work.
preloadGreyPegasusIcon();

installTouchZoomGuard();

function lockPortraitOrientation() {
  const lock = screen.orientation?.lock;
  if (!lock) return;
  lock.call(screen.orientation, 'portrait-primary').catch(() => {});
}

// Do NOT lock orientation on every pointerdown — screen.orientation.lock()
// consumes iOS Safari's transient user activation, so a later
// DeviceOrientationEvent.requestPermission() never shows the system prompt.
// Lock only after motion permission is handled, or on orientation changes.
window.addEventListener('orientationchange', lockPortraitOrientation);

const btnStart = document.getElementById('btn-start');
const btnRecalibrate = document.getElementById('btn-recalibrate');
const permissionHint = document.getElementById('permission-hint');
const selectOverlay = document.getElementById('select-overlay');
const startOverlay = document.getElementById('start-overlay');
const startBlurb = document.getElementById('start-blurb');
const playSetupEl = document.getElementById('play-setup');
const useJoystickEl = document.getElementById('use-joystick');
const steerTiltEl = document.getElementById('steer-tilt');
const controlModeCards = document.querySelectorAll('.control-mode-card');
const tiltHint = document.getElementById('tilt-hint');
const gyro = createGyroInput(document.getElementById('game-canvas'));
const joystick = createJoystickInput(document.getElementById('virtual-joystick'));

const TILT_PERMISSION_HINT =
  'Requires motion sensor access on iOS. Hold phone flat when starting.';
const JOYSTICK_PERMISSION_HINT =
  'Steer with the on-screen stick. No motion sensor needed.';
const TILT_HINT = 'Tilt phone to steer · Tap a move button to unleash a gimmick';
const JOYSTICK_HINT = 'Drag the joystick to steer · Tap a move button to unleash a gimmick';

function useJoystickChecked() {
  return Boolean(useJoystickEl?.checked);
}

function syncControlModeUi() {
  const joy = useJoystickChecked();
  controlModeCards.forEach((card) => {
    const input = card.querySelector('input[type="radio"]');
    card.classList.toggle('is-selected', Boolean(input?.checked));
  });
  if (btnStart && !btnStart.disabled) {
    btnStart.textContent = joy ? 'Start Game' : 'Calibrate & Start';
  } else if (btnStart && joy) {
    btnStart.textContent = 'Start Game';
  } else if (btnStart) {
    btnStart.textContent = 'Calibrate & Start';
  }
  if (permissionHint) {
    permissionHint.textContent = joy ? JOYSTICK_PERMISSION_HINT : TILT_PERMISSION_HINT;
  }
  if (tiltHint) {
    tiltHint.textContent = joy ? JOYSTICK_HINT : TILT_HINT;
  }
  btnRecalibrate?.classList.toggle('hidden', joy);
}

useJoystickEl?.addEventListener('change', syncControlModeUi);
steerTiltEl?.addEventListener('change', syncControlModeUi);
controlModeCards.forEach((card) => {
  card.addEventListener('click', () => {
    const input = card.querySelector('input[type="radio"]');
    if (!input || input.checked) return;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
});
syncControlModeUi();

createAppBootstrap({
  platform: 'mobile',
  canvas: document.getElementById('game-canvas'),
  playSetupEl,
  selectOverlay,
  startOverlay,
  btnStart,
  applyPlatformModeUi({ gameMode }) {
    if (startBlurb) startBlurb.textContent = modeBlurb(gameMode);
  },
  queryUiOptions: {
    controlsHintId: 'tilt-hint',
    playerAbilitiesId: 'player-abilities',
  },
  syncStartButtonLabel: syncControlModeUi,
  buildInput({ getGameRef, campaignCtrl, openBeySelect, btnStart, resetAIController }) {
    return {
      applySteering(state) {
        if (useJoystickChecked()) {
          joystick.applyJoystickSteer(state.playerBody, state.playerSpin);
        } else {
          gyro.applyGyroSteer(state.playerBody, state.playerSpin);
        }
        applyAISteering(state.aiBody, state.playerBody, state.aiSpin, state.playerSpin);
        tickAIAbilities(state, (slot) => getGameRef().triggerAbility('ai', slot));
      },
      async onStartClick(startGame) {
        const joy = useJoystickChecked();

        if (joy) {
          btnStart.disabled = true;
          btnStart.textContent = 'Starting…';
          joystick.show();
          lockPortraitOrientation();
          await campaignCtrl.revealArenaForCurrentOpponent?.();
          await startGame();
          campaignCtrl.updateHud();
          return;
        }

        joystick.hide();
        // CRITICAL: requestPermission must be the first await in this tap
        // handler. Do not disable the button, lock orientation, or await
        // anything else first — iOS will refuse to show the prompt.
        btnStart.textContent = 'Allow Motion…';
        const result = await gyro.requestMotionPermission();
        const granted = result?.granted === true;

        if (!granted) {
          btnStart.disabled = false;
          btnStart.textContent = 'Calibrate & Start';
          const errMsg = result?.orientation?.message || result?.motion?.message || '';
          const needsPrompt = gyro.needsIosMotionPermission?.() ?? false;
          if (needsPrompt && /user gesture|NotAllowed/i.test(errMsg)) {
            permissionHint.textContent =
              'iOS blocked the motion prompt. Tap Calibrate & Start again (do not switch apps mid-tap).';
          } else if (needsPrompt) {
            permissionHint.textContent =
              'Motion access denied. In iOS Settings → Safari → Motion & Orientation Access, allow it, then tap again. Or use On-screen stick.';
          } else {
            permissionHint.textContent =
              'Motion sensors unavailable. On desktop, use mouse to steer — or pick On-screen stick on phone.';
          }
          gyro.setMouseFallback();
          return;
        }

        btnStart.disabled = true;
        btnStart.textContent = 'Calibrating…';
        gyro.clearMouseFallback?.();
        gyro.startListening();
        const calibrated = await gyro.calibrateOnce();
        if (!calibrated && !gyro.hasOrientation?.()) {
          btnStart.disabled = false;
          btnStart.textContent = 'Calibrate & Start';
          permissionHint.textContent =
            'Permission granted, but no tilt data yet. Hold the phone flat and tap again.';
          return;
        }

        lockPortraitOrientation();
        await campaignCtrl.revealArenaForCurrentOpponent?.();
        await startGame();
        campaignCtrl.updateHud();
      },
      onMatchEnd: (result) => campaignCtrl.handleMatchEnd(result),
      async onRestart(resetGame) {
        if (campaignCtrl.handlesRestart()) {
          await campaignCtrl.handleRestart(resetGame);
        } else {
          resetAIController();
          await resetGame();
        }
      },
      onChangeBey: openBeySelect,
      onRecalibrate() {
        if (useJoystickChecked()) return;
        if (!btnRecalibrate || btnRecalibrate.disabled) return;
        btnRecalibrate.disabled = true;
        btnRecalibrate.setAttribute('aria-busy', 'true');
        gyro.calibrateNow();
        requestAnimationFrame(() => {
          btnRecalibrate.disabled = false;
          btnRecalibrate.removeAttribute('aria-busy');
        });
      },
      resetControls({ leavePlay = false } = {}) {
        joystick.reset();
        if (leavePlay) joystick.hide();
      },
    };
  },
  onSelectionComplete() {
    syncControlModeUi();
  },
});

document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
