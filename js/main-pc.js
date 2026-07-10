import { createKeyboardInput } from './input/keyboard.js';
import { applyAISteering, tickAIAbilities } from './input/ai.js';
import { createAppBootstrap } from './app/bootstrap.js?v=47';
import { GAME_MODES, isVsCpu, modeBlurb } from './game/modes.js';
import { preloadGreyPegasusIcon } from './ui/beyIcon.js';

// Kick off the boot icon GLB before the rest of app bootstrap work.
preloadGreyPegasusIcon();

const startOverlay = document.getElementById('start-overlay');
const selectOverlay = document.getElementById('select-overlay');
const playSetupEl = document.getElementById('play-setup');
const startBlurb = document.getElementById('start-blurb');
const startKeys = document.getElementById('start-keys');
const controlsHint = document.getElementById('controls-hint');
const playerHudLabel = document.getElementById('player-hud-label');
const aiHudLabel = document.getElementById('ai-hud-label');
const btnStart = document.getElementById('btn-start');

createAppBootstrap({
  platform: 'pc',
  canvas: document.getElementById('game-canvas'),
  playSetupEl,
  selectOverlay,
  startOverlay,
  btnStart,
  show2Player: true,
  applyPlatformModeUi({ gameMode, isVsCpu: vsCpu }) {
    document.body.classList.toggle('vs-cpu', vsCpu);
    document.body.classList.toggle('vs-2p', gameMode === GAME_MODES.TWO_PLAYER);

    if (playerHudLabel) playerHudLabel.textContent = vsCpu ? 'You · Spin' : 'P1 · Spin';
    if (aiHudLabel) aiHudLabel.textContent = vsCpu ? 'CPU · Spin' : 'P2 · Spin';

    if (controlsHint) {
      controlsHint.innerHTML = vsCpu
        ? 'WASD to steer · <kbd>Q</kbd> power · <kbd>E</kbd> special'
        : 'P1: WASD · <kbd>Q</kbd> power · <kbd>E</kbd> special &nbsp;|&nbsp; P2: Arrows · <kbd>N</kbd> power · <kbd>M</kbd> special';
    }

    if (startBlurb) startBlurb.textContent = modeBlurb(gameMode);
    if (startKeys) startKeys.style.display = gameMode === GAME_MODES.TWO_PLAYER ? 'flex' : 'none';
  },
  queryUiOptions: {
    controlsHintId: 'controls-hint',
    playerAbilitiesId: 'p1-abilities',
    aiAbilitiesId: 'p2-abilities',
  },
  buildInput({
    getGameRef,
    getGameMode,
    getBeysChosen,
    campaignCtrl,
    openBeySelect,
    startOverlay,
    resetAIController,
  }) {
    const keyboard = createKeyboardInput(
      () => {
        if (!getBeysChosen()) return;
        if (startOverlay.classList.contains('hidden')) return;
        void (async () => {
          resetAIController();
          await campaignCtrl.revealArenaForCurrentOpponent?.();
          await getGameRef()?.startGame();
          campaignCtrl.updateHud();
        })();
      },
      () => {
        const gameRef = getGameRef();
        if (gameRef?.state.gameFrozen) {
          void campaignCtrl.handleRestart(gameRef.resetGame.bind(gameRef));
        }
      },
      (player, slot) => {
        if (isVsCpu(getGameMode()) && player === 2) return;
        getGameRef()?.triggerAbility(player === 1 ? 'player' : 'ai', slot);
      },
      {
        canRestart: () => Boolean(getGameRef()?.state.gameFrozen),
        canStart: () => getBeysChosen() && !startOverlay.classList.contains('hidden'),
      }
    );

    return {
      clearKeys: keyboard.clearKeys,
      applySteering(state) {
        if (isVsCpu(getGameMode())) {
          keyboard.applyPlayer1Steer(state.playerBody, state.playerSpin);
          applyAISteering(state.aiBody, state.playerBody, state.aiSpin, state.playerSpin);
          tickAIAbilities(state, (slot) => getGameRef().triggerAbility('ai', slot));
        } else {
          keyboard.applyPlayer1Steer(state.playerBody, state.playerSpin);
          keyboard.applyPlayer2Steer(state.aiBody, state.aiSpin);
        }
      },
      async onStartClick(startGame) {
        resetAIController();
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
    };
  },
});
