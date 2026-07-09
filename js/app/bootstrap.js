import { createGame } from '../game/engine.js';
import { applyAISteering, tickAIAbilities, resetAIController } from '../input/ai.js';
import { createBeySelection } from '../ui/selection.js';
import { createPlaySetup } from '../ui/playSetup.js';
import { queryGameUi } from '../ui/domRefs.js';
import { createCampaignController } from '../game/campaignController.js';
import { GAME_MODES, isVsCpu, modeBlurb } from '../game/modes.js';
import { BEYS, isBeyPlayable } from '../game/beys.js';
import { preloadTopModel, preloadPlayableModels } from '../render/modelCache.js';
import { mountBeyIcon, preloadGreyPegasusIcon } from '../ui/beyIcon.js';

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
  });

  function getPlayers() {
    if (gameMode === GAME_MODES.TWO_PLAYER) {
      return [{ label: 'PLAYER 1' }, { label: 'PLAYER 2' }];
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
    const { mode, difficulty: diff } = playSetup.getState();
    gameMode = mode;
    difficulty = diff;

    gameRef.state.playerBey = picks[0];
    if (gameMode === GAME_MODES.TOURNAMENT) {
      campaignCtrl.startTournament(picks[0]);
    } else if (gameMode === GAME_MODES.CASUAL) {
      campaignCtrl.startCasual(picks[0], difficulty);
    } else {
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
    onChange({ mode, difficulty: diff }) {
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
          campaignCtrl.startTournament(prevBey);
        } else {
          campaignCtrl.startCasual(prevBey, difficulty);
        }
      } else {
        beysChosen = false;
        btnStart.disabled = true;
        selection?.reset(getPlayers(), {
          preserveBeyId: prevBey?.id ?? null,
          keepCarousel: !prevBey,
        });
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

  gameRef = createGame({
    mode: platform === 'mobile' ? 'mobile' : 'pc',
    canvas,
    isVsCpu: () => isVsCpu(gameMode),
    ui: queryGameUi(queryUiOptions),
    input,
  });

  // Start grey Pegasus GLB immediately, then mount icons on the shared renderer.
  const getSharedRenderer = () => gameRef?.renderer ?? null;
  preloadGreyPegasusIcon();
  mountBeyIcon(document.getElementById('boot-bey-icon'), {
    overlayEl: document.getElementById('boot-overlay'),
    getRenderer: getSharedRenderer,
  });
  mountBeyIcon(document.getElementById('start-bey-icon'), {
    overlayEl: startOverlay,
    getRenderer: getSharedRenderer,
  });

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
  // Load Pegasus first so the boot icon GLB wins the network queue.
  const playable = BEYS.filter(isBeyPlayable).sort((a, b) => {
    if (a.id === 'pegasus') return -1;
    if (b.id === 'pegasus') return 1;
    return 0;
  });

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
    document.body.classList.add('boot-ready');
    if (bootOverlay) {
      bootOverlay.classList.add('hidden');
      bootOverlay.setAttribute('aria-busy', 'false');
    }
  }

  if (bootStatus) bootStatus.textContent = 'Loading beys…';
  const bootSafety = setTimeout(() => {
    if (!document.body.classList.contains('boot-ready')) {
      if (bootStatus) bootStatus.textContent = 'Almost ready…';
      finishBoot();
    }
  }, 20000);

  preloadPlayableModels(playable, { onProgress: setBootProgress })
    .catch(() => {})
    .finally(() => {
      clearTimeout(bootSafety);
      finishBoot();
    });

  return { gameRef, selection, campaignCtrl, playSetup, get gameMode() { return gameMode; } };
}
