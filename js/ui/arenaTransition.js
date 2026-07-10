/**
 * Full-screen stadium reveal used when a tournament rival's arena loads.
 * Shown for the first rival on Start, and again on each Next Rival.
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureOverlay() {
  let el = document.getElementById('arena-transition');
  if (el) return el;

  el = document.createElement('div');
  el.id = 'arena-transition';
  el.className = 'arena-transition';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = `
    <div class="arena-transition-card">
      <p class="arena-transition-kicker">Entering</p>
      <h2 class="arena-transition-title"></h2>
      <p class="arena-transition-sub"></p>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

/**
 * @param {{
 *   skinName: string,
 *   subtitle?: string,
 *   accent?: string,
 *   onMidpoint?: () => void,
 * }} opts
 */
export async function playArenaTransition(opts) {
  const { skinName, subtitle = '', accent = '#4f8cff', onMidpoint } = opts;
  const el = ensureOverlay();
  const titleEl = el.querySelector('.arena-transition-title');
  const subEl = el.querySelector('.arena-transition-sub');

  if (titleEl) titleEl.textContent = skinName || 'Arena';
  if (subEl) {
    subEl.textContent = subtitle || '';
    subEl.classList.toggle('hidden', !subtitle);
  }
  el.style.setProperty('--arena-accent', accent);

  el.classList.remove('is-out', 'is-hold', 'is-in', 'is-active');
  // Force reflow so the next class add restarts transitions.
  void el.offsetWidth;
  el.classList.add('is-active', 'is-in');
  el.setAttribute('aria-hidden', 'false');

  await sleep(380);
  onMidpoint?.();
  el.classList.add('is-hold');
  await sleep(1100);

  el.classList.remove('is-in', 'is-hold');
  el.classList.add('is-out');
  await sleep(360);

  el.classList.remove('is-active', 'is-out');
  el.setAttribute('aria-hidden', 'true');
}
