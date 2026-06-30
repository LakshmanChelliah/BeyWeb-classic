import * as C from './constants.js';
import * as shared from './shared.js';

export function shouldStarBlastGlow(body) {
  if (!body) return false;
  if (body.userData.starBlastWindup) return true;
  const phase = body.userData.starPhase;
  return phase === 'dash' || phase === 'ascend' || phase === 'dive';
}

/** Max visual flight height across both tops — used for other cinematic camera lift. */
export function getCinematicFlightLift(state) {
  let lift = 0;
  for (const body of [state.playerBody, state.aiBody]) {
    if (!body) continue;
    lift = Math.max(lift, body.userData.flightLift ?? 0);
  }
  return lift;
}

let _camSmoothLift = 0;
let _camStadiumT = 0;
let _camFocusX = 0;
let _camFocusZ = 0;
let _camFocusReady = false;

function koWinnerFocus(state) {
  if (!state.pendingKo) return null;
  const winner = state.pendingKo.loser === 1 ? state.aiBody : state.playerBody;
  if (!winner) return null;
  return { x: winner.position.x, z: winner.position.z };
}

function normalCameraFocus(state) {
  const positions = [];
  if (state.playerBody && !state.playerBody.userData.ringOut) {
    positions.push(state.playerBody.position);
  }
  if (state.aiBody && !state.aiBody.userData.ringOut) {
    positions.push(state.aiBody.position);
  }
  if (positions.length === 0) return { x: 0, z: 0 };
  let x = 0;
  let z = 0;
  for (const p of positions) {
    x += p.x;
    z += p.z;
  }
  return { x: x / positions.length, z: z / positions.length };
}

function findActiveStarBlast(state) {
  for (const side of ['player', 'ai']) {
    const slot = state.abilities?.[side]?.special;
    if (!slot || slot.ability?.id !== 'pegasus_star_blast') continue;
    const body = side === 'player' ? state.playerBody : state.aiBody;
    if (!body) continue;
    const inMove =
      slot.windupRemaining > 0 ||
      slot.active ||
      body.userData.starBlastWindup ||
      body.userData.starPhase != null;
    if (!inMove) continue;
    return true;
  }
  return false;
}

/** Stadium overview while Star Blast plays; eases back to normal tracking afterward. */
export function getCameraCue(state, dt, mode) {
  const starBlast = findActiveStarBlast(state);
  const koActive = !!state.pendingKo;

  const stadiumTarget = starBlast ? 1 : 0;
  const stadiumRate = starBlast ? 6 : 3.5;
  _camStadiumT += (stadiumTarget - _camStadiumT) * (1 - Math.exp(-stadiumRate * dt));

  const targetLift = starBlast ? 0 : getCinematicFlightLift(state);
  const liftRate = starBlast ? 10 : 8;
  _camSmoothLift += (targetLift - _camSmoothLift) * (1 - Math.exp(-liftRate * dt));

  const duelFocus = normalCameraFocus(state);
  const winnerFocus = koWinnerFocus(state);
  let targetX = duelFocus.x;
  let targetZ = duelFocus.z;
  if (winnerFocus) {
    targetX = winnerFocus.x;
    targetZ = winnerFocus.z;
  }

  if (!_camFocusReady) {
    _camFocusX = targetX;
    _camFocusZ = targetZ;
    _camFocusReady = true;
  }

  const focusRate = koActive ? 1.5 : 5.5;
  const focusStep = 1 - Math.exp(-focusRate * dt);
  _camFocusX += (targetX - _camFocusX) * focusStep;
  _camFocusZ += (targetZ - _camFocusZ) * focusStep;

  const t = _camStadiumT;
  const focusX = _camFocusX * (1 - t);
  const focusZ = _camFocusZ * (1 - t);

  const baseCamY = 24 + _camSmoothLift * 0.5;
  const baseCamZ = 20 + _camSmoothLift * 0.1;
  const baseLookY = _camSmoothLift * 0.38;

  return {
    focusX,
    focusZ,
    camY: baseCamY + (C.STAR_BLAST_CAM_Y - baseCamY) * t,
    camZ: baseCamZ + (C.STAR_BLAST_CAM_Z - baseCamZ) * t,
    lookY: baseLookY + (C.STAR_BLAST_CAM_LOOK_Y - baseLookY) * t,
    stabilized: starBlast && t > 0.04,
    koCinematic: koActive,
  };
}

export function resetStarBlastCamera() {
  _camSmoothLift = 0;
  _camStadiumT = 0;
  _camFocusReady = false;
}

/** Per frame: advance cooldown, windup (then activate), and active duration. */
