import { BEYS, isBeyPlayable } from '../game/beys.js';
import { ABILITY_REGISTRY } from '../game/abilities.js';
import { renderBeyPackagingStars } from './beyPackagingStars.js';

/**
 * Builds the 3D carousel bey-selection screen.
 *
 * Players pick in turn. Once a bey is chosen it is locked and cannot be picked
 * by a later player. When every player has chosen, `onComplete(picks)` fires
 * with the selected bey objects (index-aligned to `players`).
 *
 * @param {object}   opts
 * @param {HTMLElement} opts.root      Overlay container to populate.
 * @param {{label:string}[]} opts.players  Pickers, in turn order.
 * @param {(picks:object[]) => void} opts.onComplete
 */
export function createBeySelection({ root, players, onComplete, rivalLabel = null }) {
  const ROSTER = BEYS.filter(isBeyPlayable);
  const locked = new Set();
  const picks = [];
  let turn = 0;
  let rivalPick = null;
  let currentIndex = 0;

  let mount = root.querySelector('.select-mount');
  let picksEl = root.querySelector('.select-picks');

  if (!mount) {
    mount = document.createElement('div');
    mount.className = 'select-mount';
    root.appendChild(mount);
  }

  if (!picksEl) {
    picksEl = document.createElement('div');
    picksEl.className = 'select-picks';
    root.appendChild(picksEl);
  }

  // Legacy: picks used to live inside .select-mount — always hoist to overlay root.
  mount.querySelectorAll('.select-picks').forEach((el) => el.remove());
  if (picksEl.parentElement !== root) {
    root.appendChild(picksEl);
  }

  mount.innerHTML = `
    <div class="select-header">
      <h1 class="select-title"></h1>
      <p class="select-sub">Choose your bey</p>
    </div>
    <div class="carousel-scene">
      <button class="carousel-arrow left" type="button" aria-label="Previous">&#8249;</button>
      <button class="carousel-arrow right" type="button" aria-label="Next">&#8250;</button>
      <div class="carousel-container"></div>
    </div>
    <div class="carousel-indicators"></div>
    <div class="select-confirm">
      <button class="select-confirm-btn" type="button">SELECT</button>
    </div>
  `;

  const titleEl = mount.querySelector('.select-title');
  const carousel = mount.querySelector('.carousel-container');
  const scene = mount.querySelector('.carousel-scene');
  const indicators = mount.querySelector('.carousel-indicators');
  const prevBtn = mount.querySelector('.carousel-arrow.left');
  const nextBtn = mount.querySelector('.carousel-arrow.right');
  const confirmWrap = mount.querySelector('.select-confirm');
  const confirmBtn = mount.querySelector('.select-confirm-btn');

  const statsBlock = (bey) =>
    isBeyPlayable(bey)
      ? renderBeyPackagingStars(bey)
      : renderBeyPackagingStars(bey, { mystery: true });

  const movesBlock = (bey) => {
    const g = bey.gimmicks;
    if (!g) return '';
    const rows = [];
    const add = (tag, id) => {
      const a = id ? ABILITY_REGISTRY[id] : null;
      if (a) rows.push(`<div class="bey-move"><span class="bey-move-tag">${tag}</span><span class="bey-move-name">${a.name}</span></div>`);
    };
    add('PWR', g.power);
    add('SPC', g.special);
    add('PSV', g.passive);
    return rows.length ? `<div class="bey-moves">${rows.join('')}</div>` : '';
  };

  const emblemBlock = (bey) => {
    if (bey.logo) {
      return `<img class="bey-emblem-img${bey.id ? ` bey-emblem-img--${bey.id}` : ''}" src="${bey.logo}" alt="" />`;
    }
    const letter = isBeyPlayable(bey) ? bey.name.charAt(0) : '?';
    return `<span>${letter}</span>`;
  };

  const cards = ROSTER.map((bey, i) => {
    const item = document.createElement('div');
    item.className = 'bey-item';
    item.dataset.index = String(i);
    item.innerHTML = `
      <div class="bey-card${isBeyPlayable(bey) ? '' : ' mystery'}" style="--bey-color:${bey.color}">
        <div class="bey-emblem${bey.id ? ` bey-emblem--${bey.id}` : ''}">${emblemBlock(bey)}</div>
        <div class="bey-type">${bey.type}</div>
        <h2 class="bey-name">${bey.name}</h2>
        <p class="bey-desc">${bey.desc}</p>
        ${statsBlock(bey)}
        ${movesBlock(bey)}
        <button class="bey-select-btn" type="button">SELECT</button>
        <div class="bey-taken">TAKEN</div>
      </div>`;
    carousel.appendChild(item);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'carousel-dot';
    dot.setAttribute('aria-label', `Show ${bey.name}`);
    indicators.appendChild(dot);

    // Side cards stay tappable so players can jump to any roster bey (not only arrows).
    item.addEventListener('click', () => {
      if (i !== currentIndex) {
        currentIndex = i;
        render();
      }
    });
    item.querySelector('.bey-select-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      confirmPick(i);
    });
    dot.addEventListener('click', (e) => {
      e.stopPropagation();
      if (locked.has(bey.id) && turn < players.length) return;
      currentIndex = i;
      render();
    });
    return item;
  });

  const dots = Array.from(indicators.children);
  const isMobile = document.body.classList.contains('mobile');

  confirmBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    confirmPick(currentIndex);
  });

  function nextOpenIndex(from) {
    for (let step = 0; step < ROSTER.length; step++) {
      const idx = (from + step) % ROSTER.length;
      if (!locked.has(ROSTER[idx].id)) return idx;
    }
    return from;
  }

  function confirmPick(i) {
    const bey = ROSTER[i];
    if (locked.has(bey.id) || turn >= players.length) return;

    locked.add(bey.id);
    picks.push(bey);
    turn += 1;

    if (turn >= players.length) {
      render();
      onComplete(picks);
      return;
    }

    currentIndex = nextOpenIndex((i + 1) % ROSTER.length);
    render();
  }

  function render() {
    const total = ROSTER.length;
    const radius = isMobile ? Math.max(198, total * 46) : Math.max(360, total * 95);
    const picking = turn < players.length;
    const centerBey = ROSTER[currentIndex];
    const centerTaken = locked.has(centerBey.id);

    cards.forEach((item, i) => {
      const bey = ROSTER[i];
      const isCenter = i === currentIndex;
      const card = item.querySelector('.bey-card');
      const btn = item.querySelector('.bey-select-btn');
      const taken = locked.has(bey.id);

      item.hidden = false;
      const angle = (i - currentIndex) * (360 / total);
      const rad = angle * (Math.PI / 180);
      const x = Math.sin(rad) * radius;
      const z = Math.cos(rad) * radius - radius;
      const scale = isMobile ? (isCenter ? 1 : 0.74) : isCenter ? 1.08 : 0.78;
      const opacity = Math.max(isMobile ? 0.2 : 0.18, (z + radius) / radius);

      item.style.transform = `translateX(${x}px) translateZ(${z}px) scale(${scale})`;
      item.style.opacity = String(opacity);
      item.style.filter = isCenter ? 'none' : isMobile ? 'blur(2px) brightness(0.58)' : 'blur(3px) brightness(0.55)';
      item.style.zIndex = String(Math.round(z + radius));
      // Keep side cards clickable so any roster bey can be brought to center.
      item.style.pointerEvents = 'auto';

      card.classList.toggle('active', isCenter);
      card.classList.toggle('taken', taken);
      // Card-local SELECT stays as a fallback; primary confirm is outside the 3D transform.
      btn.disabled = taken || !isCenter || !picking;
      btn.textContent = taken ? 'TAKEN' : 'SELECT';
      btn.hidden = isMobile;
    });

    dots.forEach((d, i) => {
      d.classList.toggle('on', i === currentIndex);
      d.disabled = locked.has(ROSTER[i].id) && picking;
    });

    if (confirmWrap && confirmBtn) {
      confirmWrap.hidden = !picking;
      confirmBtn.disabled = !picking || centerTaken;
      confirmBtn.textContent = centerTaken ? 'TAKEN' : 'SELECT';
      confirmBtn.style.setProperty('--bey-color', centerBey.color || '#4f8cff');
      confirmBtn.setAttribute(
        'aria-label',
        centerTaken ? `${centerBey.name} already taken` : `Select ${centerBey.name}`
      );
    }

    if (picking) {
      titleEl.textContent = isMobile ? 'CHOOSE YOUR BEY' : `${players[turn].label}: CHOOSE YOUR BEY`;
    } else {
      titleEl.textContent = 'BATTLE READY';
    }

    const labelHtml = (text) => `<span class="pick-label">${text}</span>`;

    if (isMobile) {
      picksEl.innerHTML = '';
    } else {
      const playerSlots = players
        .map((p, i) => {
          const pick = picks[i];
          const active = i === turn ? ' active' : '';
          const chip = pick
            ? `<span class="pick-bey" style="--bey-color:${pick.color}">${pick.name}</span>`
              : `<span class="pick-bey empty">choosing...</span>`;
          return `<div class="pick-slot${active}">${labelHtml(p.label)}${chip}</div>`;
        })
        .join('');

      let rivalSlot = '';
      let rivalNote = '';
      if (rivalLabel) {
        const chip = rivalPick
          ? `<span class="pick-bey" style="--bey-color:${rivalPick.color}">${rivalPick.name}</span>`
          : `<span class="pick-bey empty">random</span>`;
        rivalSlot = `<div class="pick-slot rival-slot">${labelHtml(rivalLabel)}${chip}</div>`;
        if (!rivalPick) {
          rivalNote = '<p class="select-picks-note">Rival rolled after you select</p>';
        }
      }

      picksEl.innerHTML = `<div class="select-picks-chips">${playerSlots}${rivalSlot}</div>${rivalNote}`;
    }
  }

  function prevOpenIndex(from) {
    for (let step = 1; step <= ROSTER.length; step++) {
      const idx = (from - step + ROSTER.length) % ROSTER.length;
      if (!locked.has(ROSTER[idx].id)) return idx;
    }
    return from;
  }

  prevBtn.addEventListener('click', () => {
    currentIndex = prevOpenIndex(currentIndex);
    render();
  });
  nextBtn.addEventListener('click', () => {
    currentIndex = nextOpenIndex((currentIndex + 1) % ROSTER.length);
    render();
  });

  // Swipe / drag on the carousel so mobile players can reach every bey without
  // relying only on the side arrows (Pegasus is the default center card).
  let swipeX = null;
  let swipeY = null;
  let swipeLocked = false;
  const SWIPE_THRESHOLD = 42;

  function onSwipeStart(clientX, clientY) {
    swipeX = clientX;
    swipeY = clientY;
    swipeLocked = false;
  }

  function onSwipeMove(clientX, clientY, event) {
    if (swipeX == null) return;
    const dx = clientX - swipeX;
    const dy = clientY - swipeY;
    if (!swipeLocked && Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy)) {
      swipeLocked = true;
    }
    if (swipeLocked) event.preventDefault();
  }

  function onSwipeEnd(clientX) {
    if (swipeX == null) return;
    const dx = clientX - swipeX;
    swipeX = null;
    swipeY = null;
    if (!swipeLocked || Math.abs(dx) < SWIPE_THRESHOLD) {
      swipeLocked = false;
      return;
    }
    if (dx < 0) currentIndex = nextOpenIndex((currentIndex + 1) % ROSTER.length);
    else currentIndex = prevOpenIndex(currentIndex);
    swipeLocked = false;
    render();
  }

  scene.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches.length !== 1) return;
      onSwipeStart(e.touches[0].clientX, e.touches[0].clientY);
    },
    { passive: true }
  );
  scene.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length !== 1 || swipeX == null) return;
      onSwipeMove(e.touches[0].clientX, e.touches[0].clientY, e);
    },
    { passive: false }
  );
  scene.addEventListener(
    'touchend',
    (e) => {
      const t = e.changedTouches[0];
      if (t) onSwipeEnd(t.clientX);
    },
    { passive: true }
  );
  scene.addEventListener('touchcancel', () => {
    swipeX = null;
    swipeY = null;
    swipeLocked = false;
  });

  scene.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    onSwipeStart(e.clientX, e.clientY);
  });
  scene.addEventListener('pointermove', (e) => {
    if (swipeX == null || e.pointerType === 'touch') return;
    onSwipeMove(e.clientX, e.clientY, e);
  });
  scene.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') return;
    onSwipeEnd(e.clientX);
  });
  scene.addEventListener('pointercancel', () => {
    swipeX = null;
    swipeY = null;
    swipeLocked = false;
  });

  render();

  return {
    /** Returns remaining (unlocked, playable) beys — handy for an AI auto-pick. */
    remaining() {
      return BEYS.filter((b) => isBeyPlayable(b) && !locked.has(b.id));
    },
    /** Restart picks (e.g. when switching VS CPU / 2-player). */
    reset(newPlayers, { keepCarousel = false, preserveBeyId = null, autoPick = false } = {}) {
      const prevId = preserveBeyId ?? (keepCarousel ? ROSTER[currentIndex]?.id : null);
      players.splice(0, players.length, ...newPlayers);
      locked.clear();
      picks.length = 0;
      rivalPick = null;
      turn = 0;

      if (autoPick && prevId && players.length === 1) {
        const bey = ROSTER.find((b) => b.id === prevId);
        if (bey) {
          locked.add(bey.id);
          picks.push(bey);
          turn = players.length;
          const idx = ROSTER.findIndex((b) => b.id === prevId);
          currentIndex = idx >= 0 ? idx : nextOpenIndex(0);
          render();
          return;
        }
      }

      if (prevId) {
        const idx = ROSTER.findIndex((b) => b.id === prevId);
        currentIndex = idx >= 0 ? idx : nextOpenIndex(0);
      } else {
        currentIndex = nextOpenIndex(0);
      }
      render();
    },
    /** Show which bey the CPU / rival auto-picked. */
    setRivalPick(bey) {
      rivalPick = bey;
      render();
    },
    /** Toggle the extra rival slot (VS CPU on PC). */
    setRivalLabel(label) {
      rivalLabel = label;
      rivalPick = null;
      render();
    },
  };
}
