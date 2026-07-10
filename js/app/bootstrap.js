import { createGame } from '../game/engine.js?v=44';
import { applyAISteering, tickAIAbilities, resetAIController } from '../input/ai.js';
import { createBeySelection } from '../ui/selection.js';
import { createPlaySetup } from '../ui/playSetup.js?v=44';
import { queryGameUi } from '../ui/domRefs.js';
import { createCampaignController } from '../game/campaignController.js?v=44';
import { GAME_MODES, isVsCpu, modeBlurb } from '../game/modes.js';
import { BEYS, isBeyPlayable } from '../game/beys.js';
import { pickLoadingTip } from '../game/tips.js';
import { preloadTopModel, preloadPlayableModels } from '../render/modelCache.js';
import { mountBeyIcon, preloadGreyPegasusIcon } from '../ui/beyIcon.js';
import {
  getArenaSkinForBey,
  resolveArenaSkinId,
} from '../render/arenaSkins.js?v=44';
import { getTournamentBlader } from '../game/campaign.js';
import { playArenaTransition } from '../ui/arenaTransition.js?v=44';

/** Capture API is optional QA tooling — never block boot if it fails to load. */
function installCaptureApiLazy(app) {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('capture');
    if (raw == null) return;
    const v = String(raw).trim().toLowerCase();
    if (!(v === '' || v === '1' || v === 'true' || v === 'yes' || v === 'on')) return;
  } catch {
    return;
  }
  import('../debug/captureApi.js')
    .then((m) => m.installCaptureApi?.(app))
    .catch((err) => console.warn('[bey-capture] failed to load', err));
}

/**
 * Shared mobile/PC bootstrap: campaign, play setup, bey selection, and game wiring.
 */
export function createAppBootstrap({
  platform,
  canvas,
  playSetupEl,
  selectOverlay,
  startOverlay,
  btnStart,
  show2Player = false,
  buildInput,
  queryUiOptions = {},
  applyPlatformModeUi,
  onSelectionComplete,
  syncStartButtonLabel,
  initStartOverlayHidden = true,
}) {
  let gameMode = GAME_MODES.TOURNAMENT;
  let difficulty = 1;
  let beysChosen = false;
  let gameRef = null;
  let selection = null;

  const campaignCtrl = createCampaignController({
    campaignHud: document.getElementById('campaign-hud'),
    gameoverTitle: document.getElementById('gameover-title'),
    gameoverMsg: document.getElementById('gameover-msg'),
    btnRestart: document.getElementById('btn-restart'),
    isEnabled: () => isVsCpu(gameMode) || gameMode === GAME_MODES.TWO_PLAYER,
    getPlayerBey: () => gameRef?.state.playerBey,
    onOpponentChange(opp) {
      gameRef.state.aiBey = opp;
      selection?.setRivalPick(opp);
      if (opp?.model) preloadTopModel(opp.model);
    },
    async onArenaTransition(opp, { animate = false } = {}) {
      if (!opp?.id || !gameRef?.setArenaSkin) return;
      const skin = getArenaSkinForBey(opp.id);
      const apply = () => gameRef.setArenaSkin(skin.id, { persist: false });

      // Silent apply while select/start overlays cover the canvas.
      if (!animate) {
        apply();
        return;
      }

      // Always play the reveal when requested (even if skin already applied).
      const blader = getTournamentBlader(opp.id);
      const accent = `#${(skin.dishLip >>> 0).toString(16).padStart(6, '0')}`;
      document.getElementById('gameover-overlay')?.classList.remove('visible');
      startOverlay?.classList.add('hidden');
      await playArenaTransition({
        skinName: skin.name,
        subtitle: blader ? `${blader.name} · ${opp.name}` : opp.name,
        accent,
        onMidpoint: apply,
      });
    },
  });

  function restoreUserArenaSkin() {
    const preferred = playSetup?.getState?.().arenaSkin ?? resolveArenaSkinId();
    gameRef?.setArenaSkin?.(preferred, { persist: true });
  }

  function getPlayers() {
    if (gameMode === GAME_MODES.TWO_PLAYER) {
      return [
        { label: 'PLAYER 1', controls: 'WASD · Q power · E special' },
        { label: 'PLAYER 2', controls: 'Arrows · N power · M special' },
      ];
    }
    if (platform === 'pc') {
      return [{ label: 'YOU', controls: 'WASD · Q power · E special' }];
    }
    return [{ label: 'YOU' }];
  }

  function getRivalLabel() {
    return isVsCpu(gameMode) ? 'CPU' : null;
  }

  function applyModeUi() {
    applyPlatformModeUi?.({ gameMode, isVsCpu: isVsCpu(gameMode) });
    campaignCtrl.updateHud();
  }

  function openBeySelect() {
    const preserveBeyId = beysChosen ? gameRef?.state.playerBey?.id : null;
    campaignCtrl.resetCampaign();
    restoreUserArenaSkin();
    resetAIController();
    selection?.reset(getPlayers(), {
      preserveBeyId,
      keepCarousel: !preserveBeyId,
    });
    selection?.setRivalLabel(getRivalLabel());
    gameRef.returnToMenu();
    selectOverlay.classList.remove('hidden');
    startOverlay.classList.add('hidden');
    document.getElementById('campaign-hud')?.classList.add('hidden');
    beysChosen = false;
    btnStart.disabled = true;
    if (platform === 'mobile') {
      if (syncStartButtonLabel) syncStartButtonLabel();
      else btnStart.textContent = 'Calibrate & Start';
    }
  }

  async function handleSelectionComplete(picks) {
    const { mode, difficulty: diff, arenaSkin } = playSetup.getState();
    gameMode = mode;
    difficulty = diff;

    gameRef.state.playerBey = picks[0];
    if (gameMode === GAME_MODES.TOURNAMENT) {
      await campaignCtrl.startTournament(picks[0]);
    } else if (gameMode === GAME_MODES.CASUAL) {
      if (arenaSkin) gameRef.setArenaSkin(arenaSkin, { persist: true });
      await campaignCtrl.startCasual(picks[0], difficulty);
    } else {
      if (arenaSkin) gameRef.setArenaSkin(arenaSkin, { persist: true });
      gameRef.state.aiBey = picks[1];
      campaignCtrl.startLocalSeries();
    }

    await Promise.all([
      preloadTopModel(picks[0].model),
      preloadTopModel(gameRef.state.aiBey?.model),
    ]);

    beysChosen = true;
    btnStart.disabled = false;
    resetAIController();
    applyModeUi();
    onSelectionComplete?.({ beysChosen: true });
    setTimeout(() => {
      selectOverlay.classList.add('hidden');
      startOverlay.classList.remove('hidden');
    }, 600);
  }

  selection = createBeySelection({
    root: selectOverlay,
    players: getPlayers(),
    rivalLabel: getRivalLabel(),
    onComplete: handleSelectionComplete,
  });

  const playSetup = createPlaySetup(playSetupEl, {
    show2Player,
    onChange({ mode, difficulty: diff, arenaSkin }) {
      // Skin-only changes (casual / 2P dropdown) — persist user preference.
      if (mode === gameMode && diff === difficulty) {
        if (arenaSkin && mode !== GAME_MODES.TOURNAMENT) {
          gameRef?.setArenaSkin?.(arenaSkin, { persist: true });
        }
        return;
      }

      const prevBey = beysChosen ? gameRef?.state.playerBey : null;
      const hadVsCpuPick = beysChosen && isVsCpu(gameMode);
      gameMode = mode;
      difficulty = diff;
      campaignCtrl.resetCampaign();
      applyModeUi();

      const keepSameBey = hadVsCpuPick && prevBey && isVsCpu(gameMode);
      if (keepSameBey) {
        gameRef.state.playerBey = prevBey;
        beysChosen = true;
        btnStart.disabled = false;
        selection?.reset(getPlayers(), { preserveBeyId: prevBey.id, autoPick: true });
        if (gameMode === GAME_MODES.TOURNAMENT) {
          void campaignCtrl.startTournament(prevBey);
        } else {
          if (arenaSkin) gameRef.setArenaSkin(arenaSkin, { persist: true });
          void campaignCtrl.startCasual(prevBey, difficulty);
        }
      } else {
        beysChosen = false;
        btnStart.disabled = true;
        selection?.reset(getPlayers(), {
          preserveBeyId: prevBey?.id ?? null,
          keepCarousel: !prevBey,
        });
        if (mode !== GAME_MODES.TOURNAMENT) restoreUserArenaSkin();
      }

      selection?.setRivalLabel(getRivalLabel());
      if (platform === 'mobile') {
        if (syncStartButtonLabel) syncStartButtonLabel();
        else btnStart.textContent = 'Calibrate & Start';
        startOverlay.classList.add('hidden');
      }
    },
  });

  const input = buildInput({
    getGameRef: () => gameRef,
    getGameMode: () => gameMode,
    getBeysChosen: () => beysChosen,
    campaignCtrl,
    openBeySelect,
    startOverlay,
    btnStart,
    resetAIController,
  });

  // Arm HTML-independent failsafe as early as possible (covers createGame throws).
  const earlyBootSafety = setTimeout(() => {
    if (!document.body.classList.contains('boot-ready')) {
      document.body.classList.add('boot-ready');
      document.getElementById('boot-overlay')?.classList.add('hidden');
      const st = document.getElementById('boot-status');
      if (st) st.textContent = 'Almost ready…';
    }
  }, 12000);

  try {
    gameRef = createGame({
      mode: platform === 'mobile' ? 'mobile' : 'pc',
      canvas,
      isVsCpu: () => isVsCpu(gameMode),
      getDifficulty: () => difficulty,
      ui: queryGameUi(queryUiOptions),
      input,
    });
  } catch (err) {
    console.error('[boot] createGame failed', err);
    clearTimeout(earlyBootSafety);
    document.body.classList.add('boot-ready');
    document.getElementById('boot-overlay')?.classList.add('hidden');
    const st = document.getElementById('boot-status');
    if (st) st.textContent = 'Load error. Try refresh';
    // Do not rethrow: keep selection UI usable when possible.
  }

  ({ mode: gameMode, difficulty } = playSetup.getState());
  applyModeUi();
  selection?.setRivalLabel(getRivalLabel());
  btnStart.disabled = true;
  if (initStartOverlayHidden) {
    startOverlay.classList.add('hidden');
  }

  const bootOverlay = document.getElementById('boot-overlay');
  const bootStatus = document.getElementById('boot-status');
  const bootFill = document.getElementById('boot-progress-fill');
  const bootProgress = document.getElementById('boot-progress');
  const bootPct = document.getElementById('boot-pct');
  const bootTip = document.getElementById('boot-tip');
  // Load Pegasus first so the boot icon GLB wins the network queue.
  const playable = BEYS.filter(isBeyPlayable).sort((a, b) => {
    if (a.id === 'pegasus') return -1;
    if (b.id === 'pegasus') return 1;
    return 0;
  });
  let tipIndex = -1;
  let tipRotateTimer = null;
  let bootFinished = false;

  function renderBootTip(entry) {
    if (!bootTip || !entry) return;
    tipIndex = entry.index;
    bootTip.replaceChildren();
    const label = document.createElement('span');
    label.className = 'boot-tip-label';
    label.textContent = entry.label;
    bootTip.append(label, document.createTextNode(entry.tip.text));
  }

  function showBootTip(fade = false) {
    try {
      const entry = pickLoadingTip(tipIndex);
      if (!bootTip) return;
      if (!fade || !bootTip.textContent) {
        renderBootTip(entry);
        return;
      }
      bootTip.classList.add('boot-tip-fade');
      window.setTimeout(() => {
        if (!bootTip || document.body.classList.contains('boot-ready')) return;
        renderBootTip(entry);
        bootTip.classList.remove('boot-tip-fade');
      }, 280);
    } catch (err) {
      console.warn('[boot] tip rotate failed', err);
    }
  }

  function setBootProgress(done, total, bey) {
    const pct = total > 0 ? Math.round((done / total) * 100) : 100;
    if (bootFill) bootFill.style.width = `${pct}%`;
    if (bootProgress) bootProgress.setAttribute('aria-valuenow', String(pct));
    if (bootPct) bootPct.textContent = `${pct}%`;
    if (bootStatus) {
      if (done >= total) bootStatus.textContent = 'Ready';
      else if (bey?.name) bootStatus.textContent = `Loading ${bey.name}…`;
      else bootStatus.textContent = 'Loading beys…';
    }
  }

  function finishBoot() {
    if (bootFinished) return;
    bootFinished = true;
    if (tipRotateTimer != null) {
      clearInterval(tipRotateTimer);
      tipRotateTimer = null;
    }
    document.body.classList.add('boot-ready');
    if (bootOverlay) {
      bootOverlay.classList.add('hidden');
      bootOverlay.setAttribute('aria-busy', 'false');
    }
  }

  // Arm the failsafe BEFORE any icon / tip / preload work so a throw cannot
  // leave the overlay stuck at 0% forever.
  clearTimeout(earlyBootSafety);
  const bootSafety = setTimeout(() => {
    if (!document.body.classList.contains('boot-ready')) {
      if (bootStatus) bootStatus.textContent = 'Almost ready…';
      finishBoot();
    }
  }, 12000);

  // Start grey Pegasus GLB immediately, then mount icons on the shared renderer.
  const getSharedRenderer = () => gameRef?.renderer ?? null;
  try {
    preloadGreyPegasusIcon();
    mountBeyIcon(document.getElementById('boot-bey-icon'), {
      overlayEl: document.getElementById('boot-overlay'),
      getRenderer: getSharedRenderer,
    });
    mountBeyIcon(document.getElementById('start-bey-icon'), {
      overlayEl: startOverlay,
      getRenderer: getSharedRenderer,
    });
  } catch (err) {
    console.warn('[boot] bey icon mount failed', err);
  }

  if (bootStatus) bootStatus.textContent = 'Loading beys…';
  showBootTip(false);
  tipRotateTimer = setInterval(() => showBootTip(true), 4500);

  preloadPlayableModels(playable, { onProgress: setBootProgress })
    .catch((err) => {
      console.warn('[boot] model preload failed', err);
    })
    .finally(() => {
      clearTimeout(bootSafety);
      finishBoot();
    });

  const app = { gameRef, selection, campaignCtrl, playSetup, get gameMode() { return gameMode; } };
  installCaptureApiLazy(app);
  return app;
}
