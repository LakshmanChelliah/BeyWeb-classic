import { GAME_MODES } from '../game/modes.js';
import { AI_DIFFICULTIES } from '../input/ai.js';
import {
  listArenaSkins,
  resolveArenaSkinId,
  saveArenaSkinId,
} from '../render/arenaSkins.js';

/**
 * Mode + difficulty + arena skin controls rendered inside the bey-select overlay.
 * Arena skins are texture/material palettes only — stadium shape stays fixed.
 */
export function createPlaySetup(el, { show2Player = false, onChange } = {}) {
  let mode = GAME_MODES.TOURNAMENT;
  let difficulty = 1;
  let arenaSkin = resolveArenaSkinId();

  const modeButtons = show2Player
    ? [
        { id: GAME_MODES.CASUAL, label: 'Casual' },
        { id: GAME_MODES.TOURNAMENT, label: 'Tournament' },
        { id: GAME_MODES.TWO_PLAYER, label: '2 Players' },
      ]
    : [
        { id: GAME_MODES.CASUAL, label: 'Casual' },
        { id: GAME_MODES.TOURNAMENT, label: 'Tournament' },
      ];

  el.innerHTML = `
    <div class="play-setup-modes" role="tablist" aria-label="Game mode"></div>
    <div class="play-setup-diff" aria-label="CPU difficulty">
      <span class="play-setup-diff-label">CPU difficulty</span>
      <div class="play-setup-diff-btns"></div>
    </div>
    <div class="play-setup-arena" aria-label="Arena skin">
      <span class="play-setup-arena-label">Arena</span>
      <div class="play-setup-arena-btns" role="listbox" aria-label="Arena skin"></div>
    </div>
    <p class="play-setup-hint">CPU rival is random each match</p>
  `;

  const modesEl = el.querySelector('.play-setup-modes');
  const diffWrap = el.querySelector('.play-setup-diff');
  const diffBtns = el.querySelector('.play-setup-diff-btns');
  const arenaBtns = el.querySelector('.play-setup-arena-btns');
  const hintEl = el.querySelector('.play-setup-hint');

  for (const m of modeButtons) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'play-setup-mode-btn';
    btn.dataset.mode = m.id;
    btn.textContent = m.label;
    btn.addEventListener('click', () => setMode(m.id));
    modesEl.appendChild(btn);
  }

  for (const d of AI_DIFFICULTIES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'play-setup-diff-btn';
    btn.dataset.tier = String(d.tier);
    btn.textContent = d.short || d.label;
    btn.title = d.label;
    btn.setAttribute('aria-label', d.label);
    btn.addEventListener('click', () => setDifficulty(d.tier));
    diffBtns.appendChild(btn);
  }

  for (const skin of listArenaSkins()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'play-setup-arena-btn';
    btn.dataset.skin = skin.id;
    btn.textContent = skin.name;
    btn.title = skin.desc || skin.name;
    btn.setAttribute('aria-label', skin.desc || skin.name);
    btn.addEventListener('click', () => setArenaSkin(skin.id));
    arenaBtns.appendChild(btn);
  }

  function paint() {
    modesEl.querySelectorAll('.play-setup-mode-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.mode === mode);
    });
    diffBtns.querySelectorAll('.play-setup-diff-btn').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.tier) === difficulty);
    });
    arenaBtns.querySelectorAll('.play-setup-arena-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.skin === arenaSkin);
    });

    const isCasual = mode === GAME_MODES.CASUAL;
    const isTournament = mode === GAME_MODES.TOURNAMENT;
    diffWrap.classList.toggle('hidden', !isCasual);
    el.classList.toggle('play-setup--casual', isCasual);
    el.classList.toggle('play-setup--tournament', isTournament);
    el.classList.toggle('play-setup--two-player', mode === GAME_MODES.TWO_PLAYER);

    if (hintEl) {
      if (mode === GAME_MODES.TOURNAMENT) {
        hintEl.textContent = 'Seven bladers in order — Benkei to Ryuga.';
        hintEl.classList.remove('hidden');
      } else if (isCasual) {
        hintEl.textContent = 'Best of 3 vs a random rival — new rival after each series';
        hintEl.classList.remove('hidden');
      } else if (mode === GAME_MODES.TWO_PLAYER) {
        hintEl.textContent = 'Best of 5 local series';
        hintEl.classList.remove('hidden');
      } else {
        hintEl.classList.add('hidden');
      }
    }
  }

  function setMode(next) {
    if (mode === next) return;
    mode = next;
    paint();
    onChange?.(getState());
  }

  function setDifficulty(tier) {
    const t = Math.max(0, Math.min(tier, AI_DIFFICULTIES.length - 1));
    if (difficulty === t) return;
    difficulty = t;
    paint();
    onChange?.(getState());
  }

  function setArenaSkin(id) {
    if (arenaSkin === id) return;
    arenaSkin = saveArenaSkinId(id);
    paint();
    onChange?.(getState());
  }

  function getState() {
    return { mode, difficulty, arenaSkin };
  }

  paint();

  return { getState, setMode, setDifficulty, setArenaSkin, paint };
}
