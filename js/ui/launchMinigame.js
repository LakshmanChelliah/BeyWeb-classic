/**
 * Pre-round "3 · 2 · 1 · LET · IT · RIP" launch mini-game.
 * Swipe up (mobile) or Space / click (PC) on RIP.
 * Launch quality sets starting spin from bad (~70%) to perfect (120%).
 */
import { CONFIG, RUNTIME_FLAGS } from '../config.js';

const BEAT_MS = 520;
/** One-way needle sweep; full bounce is out + back. */
const METER_ONE_WAY_MS = 520;
const METER_TOTAL_MS = METER_ONE_WAY_MS * 2;
const RIP_HOLD_MS = METER_TOTAL_MS + 80;
const RESULT_HOLD_MS = 720;
/** Perfect zone is centered; radii match colored meter bands. */
const SWEET_CENTER = 0.5;
const ZONE_RADII = Object.freeze({
  perfect: 0.03,
  great: 0.07,
  good: 0.14,
  weak: 0.26,
});

const GRADE_SPIN = Object.freeze({
  miss: CONFIG.LAUNCH_SPIN_MISS,
  weak: CONFIG.LAUNCH_SPIN_WEAK,
  good: CONFIG.LAUNCH_SPIN_GOOD,
  great: CONFIG.LAUNCH_SPIN_GREAT,
  perfect: CONFIG.LAUNCH_SPIN_PERFECT,
});

const GRADE_LABEL = Object.freeze({
  miss: 'MISS',
  weak: 'WEAK',
  good: 'GOOD',
  great: 'GREAT',
  perfect: 'PERFECT!',
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

/** Symmetric zone segments from left edge → center → right edge. */
function buildMeterZonesHtml() {
  const c = SWEET_CENTER;
  const r = ZONE_RADII;
  const segments = [
    { grade: 'miss', left: 0, width: c - r.weak },
    { grade: 'weak', left: c - r.weak, width: r.weak - r.good },
    { grade: 'good', left: c - r.good, width: r.good - r.great },
    { grade: 'great', left: c - r.great, width: r.great - r.perfect },
    { grade: 'perfect', left: c - r.perfect, width: r.perfect * 2 },
    { grade: 'great', left: c + r.perfect, width: r.great - r.perfect },
    { grade: 'good', left: c + r.great, width: r.good - r.great },
    { grade: 'weak', left: c + r.good, width: r.weak - r.good },
    { grade: 'miss', left: c + r.weak, width: 1 - (c + r.weak) },
  ];
  const zones = segments
    .map(
      (s) =>
        `<div class="launch-overlay-meter-zone zone-${s.grade}" style="left:${(s.left * 100).toFixed(2)}%;width:${(s.width * 100).toFixed(2)}%"></div>`
    )
    .join('');
  const labels = `
    <div class="launch-overlay-meter-labels" aria-hidden="true">
      <span class="zone-label zone-miss">${Math.round(GRADE_SPIN.miss * 100)}%</span>
      <span class="zone-label zone-perfect">${Math.round(GRADE_SPIN.perfect * 100)}%</span>
      <span class="zone-label zone-miss">${Math.round(GRADE_SPIN.miss * 100)}%</span>
    </div>`;
  return `<div class="launch-overlay-meter-zones">${zones}</div>${labels}`;
}

function ensureMeterTrack(el) {
  const track = el.querySelector('.launch-overlay-meter-track');
  if (!track) return;
  if (track.querySelector('.launch-overlay-meter-zones')) return;
  track.innerHTML = `${buildMeterZonesHtml()}<div class="launch-overlay-meter-needle"></div>`;
}

function ensureOverlay() {
  let el = document.getElementById('launch-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'launch-overlay';
    el.className = 'launch-overlay';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
    <div class="launch-overlay-card">
      <p class="launch-overlay-kicker">Launch</p>
      <div class="launch-overlay-count" aria-live="assertive">3</div>
      <p class="launch-overlay-hint"></p>
      <div class="launch-overlay-meter" aria-hidden="true">
        <div class="launch-overlay-meter-track">
          ${buildMeterZonesHtml()}
          <div class="launch-overlay-meter-needle"></div>
        </div>
      </div>
      <p class="launch-overlay-result" hidden></p>
      <p class="launch-overlay-spin" hidden></p>
    </div>
  `;
    document.body.appendChild(el);
  } else {
    ensureMeterTrack(el);
  }
  return el;
}

function gradeFromNeedle(pos, swiped, swipePower) {
  if (!swiped) return 'miss';

  const dist = Math.abs(pos - SWEET_CENTER);
  let timing = 'miss';
  if (dist <= ZONE_RADII.perfect) timing = 'perfect';
  else if (dist <= ZONE_RADII.great) timing = 'great';
  else if (dist <= ZONE_RADII.good) timing = 'good';
  else if (dist <= ZONE_RADII.weak) timing = 'weak';

  // Weak / reverse swipe knocks the grade down one step.
  if (swipePower < 0.35) {
    if (timing === 'perfect') timing = 'great';
    else if (timing === 'great') timing = 'good';
    else if (timing === 'good') timing = 'weak';
    else timing = 'miss';
  } else if (swipePower < 0.55 && timing === 'perfect') {
    timing = 'great';
  }

  return timing;
}

/** Triangle wave 0→1→0 over progress u in [0, 1]. */
function needlePosFromProgress(u) {
  const t = clamp(u, 0, 1);
  return t <= 0.5 ? t * 2 : 2 - t * 2;
}

function spinForGrade(grade) {
  return GRADE_SPIN[grade] ?? GRADE_SPIN.miss;
}

/** CPU launch quality from difficulty (0 easy → 2 hard). */
export function rollAiLaunchGrade(difficulty = 1) {
  const d = clamp(Number(difficulty) || 1, 0, 2);
  const roll = Math.random();
  if (d <= 0) {
    if (roll < 0.08) return 'perfect';
    if (roll < 0.28) return 'great';
    if (roll < 0.62) return 'good';
    if (roll < 0.88) return 'weak';
    return 'miss';
  }
  if (d >= 2) {
    if (roll < 0.28) return 'perfect';
    if (roll < 0.62) return 'great';
    if (roll < 0.88) return 'good';
    if (roll < 0.97) return 'weak';
    return 'miss';
  }
  if (roll < 0.14) return 'perfect';
  if (roll < 0.4) return 'great';
  if (roll < 0.72) return 'good';
  if (roll < 0.92) return 'weak';
  return 'miss';
}

function defaultHint({ twoPlayer, touch }) {
  if (twoPlayer) {
    return touch
      ? 'P1 swipe left · P2 swipe right — on RIP'
      : 'P1 Space · P2 Enter — on RIP';
  }
  return touch ? 'Swipe up on RIP!' : 'Press Space or click on RIP!';
}

function isTouchPrimary() {
  return document.body.classList.contains('mobile') || navigator.maxTouchPoints > 0;
}

/**
 * @param {{
 *   vsCpu?: boolean,
 *   twoPlayer?: boolean,
 *   difficulty?: number,
 *   accent?: string,
 *   autoComplete?: boolean,
 *   autoGrade?: 'miss'|'weak'|'good'|'great'|'perfect',
 * }} opts
 * @returns {Promise<{
 *   playerSpin: number,
 *   aiSpin: number,
 *   playerGrade: string,
 *   aiGrade: string,
 * }>}
 */
export async function runLaunchMinigame(opts = {}) {
  const vsCpu = opts.vsCpu !== false;
  const twoPlayer = Boolean(opts.twoPlayer);
  const difficulty = opts.difficulty ?? 1;
  const accent = opts.accent || '#4f8cff';
  const autoComplete =
    opts.autoComplete === true ||
    RUNTIME_FLAGS.captureMode === true ||
    RUNTIME_FLAGS.autoLaunch === true;

  if (autoComplete) {
    const grade = opts.autoGrade || 'good';
    const aiGrade = vsCpu ? rollAiLaunchGrade(difficulty) : grade;
    return {
      playerSpin: spinForGrade(grade),
      aiSpin: spinForGrade(twoPlayer ? grade : aiGrade),
      playerGrade: grade,
      aiGrade: twoPlayer ? grade : aiGrade,
      auto: true,
    };
  }

  const el = ensureOverlay();
  const countEl = el.querySelector('.launch-overlay-count');
  const hintEl = el.querySelector('.launch-overlay-hint');
  const resultEl = el.querySelector('.launch-overlay-result');
  const spinEl = el.querySelector('.launch-overlay-spin');
  const needleEl = el.querySelector('.launch-overlay-meter-needle');
  const meterEl = el.querySelector('.launch-overlay-meter');
  const touch = isTouchPrimary();

  el.style.setProperty('--launch-accent', accent);
  if (hintEl) hintEl.textContent = defaultHint({ twoPlayer, touch });
  if (resultEl) {
    resultEl.hidden = true;
    resultEl.textContent = '';
    resultEl.className = 'launch-overlay-result';
  }
  if (spinEl) {
    spinEl.hidden = true;
    spinEl.textContent = '';
  }
  if (meterEl) meterEl.classList.remove('is-live');
  if (needleEl) needleEl.style.left = '0%';

  el.classList.remove('is-out', 'is-hold', 'is-in', 'is-active', 'is-rip', 'is-result');
  void el.offsetWidth;
  el.classList.add('is-active', 'is-in');
  el.setAttribute('aria-hidden', 'false');

  const inputState = {
    p1: { swiped: false, atMs: null, power: 0, needlePos: 0 },
    p2: { swiped: false, atMs: null, power: 0, needlePos: 0 },
    windowOpen: false,
    windowStart: 0,
    windowEnd: 0,
    needlePos: 0,
    done: false,
  };

  const touchTrack = new Map();

  function recordLaunch(side, power, atMs = performance.now()) {
    if (inputState.done) return;
    // Ignore taps during the 3-2-1 countdown; only the rip window counts.
    if (!inputState.windowOpen) return;
    const slot = side === 'p2' ? inputState.p2 : inputState.p1;
    if (slot.swiped) return;
    slot.swiped = true;
    slot.atMs = atMs;
    slot.power = clamp(power, 0, 1);
    slot.needlePos = inputState.needlePos;
  }

  function onKeyDown(e) {
    if (e.repeat) return;
    if (e.code === 'Space' || e.key === ' ') {
      e.preventDefault();
      recordLaunch('p1', 1);
    } else if (e.code === 'Enter' || e.key === 'Enter') {
      e.preventDefault();
      recordLaunch(twoPlayer ? 'p2' : 'p1', 1);
    }
  }

  function onPointerDown(e) {
    if (e.button != null && e.button !== 0) return;
    touchTrack.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      t: performance.now(),
      side: twoPlayer && e.clientX > window.innerWidth * 0.5 ? 'p2' : 'p1',
    });
    try {
      el.setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  }

  function onPointerUp(e) {
    const start = touchTrack.get(e.pointerId);
    touchTrack.delete(e.pointerId);
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dt = Math.max(16, performance.now() - start.t);
    const dist = Math.hypot(dx, dy);

    // Tap / click counts as a soft rip; upward swipe is full power.
    let power = 0.4;
    if (dist >= 28) {
      const up = Math.max(0, -dy);
      const ratio = up / Math.max(dist, 1);
      const speed = dist / dt;
      power = clamp(0.35 + ratio * 0.45 + Math.min(0.35, speed * 0.12), 0, 1);
      if (ratio < 0.25 && Math.abs(dy) < Math.abs(dx)) {
        power *= 0.55;
      }
    }
    recordLaunch(start.side, power);
  }

  function onClick(e) {
    // Mouse click without drag — still counts if no pointer path fired.
    if (e.pointerType === 'touch') return;
    if (inputState.p1.swiped || inputState.p2.swiped) return;
    const side = twoPlayer && e.clientX > window.innerWidth * 0.5 ? 'p2' : 'p1';
    recordLaunch(side, 0.55);
  }

  window.addEventListener('keydown', onKeyDown, true);
  el.addEventListener('pointerdown', onPointerDown);
  el.addEventListener('pointerup', onPointerUp);
  el.addEventListener('pointercancel', onPointerUp);
  el.addEventListener('click', onClick);

  const beats = ['3', '2', '1', 'LET', 'IT'];
  for (const beat of beats) {
    if (countEl) {
      countEl.textContent = beat;
      countEl.classList.remove('is-pop', 'is-rip-text');
      void countEl.offsetWidth;
      countEl.classList.add('is-pop');
    }
    el.classList.add('is-hold');
    await sleep(BEAT_MS);
  }

  // RIP — input window
  if (countEl) {
    countEl.textContent = 'RIP!';
    countEl.classList.remove('is-pop');
    void countEl.offsetWidth;
    countEl.classList.add('is-pop', 'is-rip-text');
  }
  el.classList.add('is-rip');
  if (meterEl) meterEl.classList.add('is-live');
  if (hintEl) {
    hintEl.textContent = twoPlayer
      ? touch
        ? 'Now! Swipe!'
        : 'Now! P1 Space · P2 Enter'
      : touch
        ? 'Now! Swipe up!'
        : 'Now! Space or click!';
  }

  inputState.windowOpen = true;
  inputState.windowStart = performance.now();
  inputState.windowEnd = inputState.windowStart + METER_TOTAL_MS;
  inputState.needlePos = 0;

  const needleAnim = () => {
    if (!needleEl || inputState.done) return;
    const now = performance.now();
    const u = clamp((now - inputState.windowStart) / METER_TOTAL_MS, 0, 1);
    const pos = needlePosFromProgress(u);
    inputState.needlePos = pos;
    needleEl.style.left = `${pos * 100}%`;
    if (u < 1 && el.classList.contains('is-rip')) {
      requestAnimationFrame(needleAnim);
    }
  };
  requestAnimationFrame(needleAnim);

  const waitUntil = async (predicate, timeoutMs) => {
    const start = performance.now();
    while (performance.now() - start < timeoutMs) {
      if (predicate()) return true;
      await sleep(16);
    }
    return false;
  };

  await waitUntil(() => {
    if (twoPlayer) return inputState.p1.swiped && inputState.p2.swiped;
    return inputState.p1.swiped;
  }, RIP_HOLD_MS);

  // Brief grace so late swipes still count.
  if (!inputState.p1.swiped || (twoPlayer && !inputState.p2.swiped)) {
    await sleep(180);
  }

  inputState.done = true;
  inputState.windowOpen = false;

  function resolveSide(slot) {
    if (!slot.swiped) {
      return { grade: 'miss', spin: GRADE_SPIN.miss };
    }
    const grade = gradeFromNeedle(slot.needlePos ?? 0, true, slot.power);
    return { grade, spin: spinForGrade(grade) };
  }

  const p1 = resolveSide(inputState.p1);
  let aiGrade;
  let aiSpin;
  if (twoPlayer) {
    const p2 = resolveSide(inputState.p2);
    aiGrade = p2.grade;
    aiSpin = p2.spin;
  } else if (vsCpu) {
    aiGrade = rollAiLaunchGrade(difficulty);
    aiSpin = spinForGrade(aiGrade);
  } else {
    aiGrade = p1.grade;
    aiSpin = p1.spin;
  }

  el.classList.remove('is-rip');
  el.classList.add('is-result');
  if (countEl) {
    countEl.classList.remove('is-rip-text');
    countEl.textContent = GRADE_LABEL[p1.grade] || 'MISS';
    countEl.classList.remove('is-pop');
    void countEl.offsetWidth;
    countEl.classList.add('is-pop', `grade-${p1.grade}`);
  }
  if (resultEl) {
    resultEl.hidden = false;
    resultEl.className = `launch-overlay-result grade-${p1.grade}`;
    if (twoPlayer) {
      resultEl.textContent = `P1 ${GRADE_LABEL[p1.grade]} · P2 ${GRADE_LABEL[aiGrade]}`;
    } else {
      resultEl.textContent = `${Math.round(p1.spin * 100)}% starting spin`;
    }
  }
  if (spinEl) {
    spinEl.hidden = false;
    if (twoPlayer) {
      spinEl.textContent = `P1 ${Math.round(p1.spin * 100)}% · P2 ${Math.round(aiSpin * 100)}%`;
    } else {
      spinEl.textContent = vsCpu
        ? `Rival launch ${Math.round(aiSpin * 100)}%`
        : '';
      if (!vsCpu) spinEl.hidden = true;
    }
  }
  if (hintEl) hintEl.textContent = '';
  if (meterEl) meterEl.classList.remove('is-live');

  await sleep(RESULT_HOLD_MS);

  el.classList.remove('is-in', 'is-hold', 'is-result');
  el.classList.add('is-out');
  await sleep(280);

  window.removeEventListener('keydown', onKeyDown, true);
  el.removeEventListener('pointerdown', onPointerDown);
  el.removeEventListener('pointerup', onPointerUp);
  el.removeEventListener('pointercancel', onPointerUp);
  el.removeEventListener('click', onClick);

  el.classList.remove('is-active', 'is-out', 'is-rip', 'is-result');
  if (countEl) countEl.classList.remove('is-rip-text', 'grade-miss', 'grade-weak', 'grade-good', 'grade-great', 'grade-perfect');
  el.setAttribute('aria-hidden', 'true');

  return {
    playerSpin: p1.spin,
    aiSpin,
    playerGrade: p1.grade,
    aiGrade,
    auto: false,
  };
}
