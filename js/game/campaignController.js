import {
  resetAIController,
  setAIDifficulty,
  setAIContext,
  getDifficultyLabel,
  AI_TIER_MAX,
} from '../input/ai.js';
import {
  createCampaign,
  CAMPAIGN_OPPONENT_IDS,
  getTournamentRoster,
  getAiTierForOpponentId,
  getTournamentBlader,
  getBladerDisplayName,
  applyTournamentBladerProfile,
  pickRandomRival,
  pickTournamentOpponent,
} from './campaign.js';
import { createCasualMode } from './casualMode.js';
import { createLocalSeriesMode } from './localSeriesMode.js';
import { dualSeriesDotsHtml, seriesDotsHtml, SERIES_BEST_OF } from './seriesScore.js';
import { preloadTopModel } from '../render/modelCache.js';
import { getArenaSkinForBey } from '../render/arenaSkins.js?v=44';

/**
 * Wires tournament + casual progression to DOM and game callbacks (PC and mobile).
 */
export function createCampaignController({
  campaignHud,
  gameoverTitle,
  gameoverMsg,
  btnRestart,
  isEnabled = () => true,
  onOpponentChange,
  onArenaTransition,
  getPlayerBey = () => null,
}) {
  const tournament = createCampaign();
  const casual = createCasualMode();
  const localSeries = createLocalSeriesMode();
  let activeMode = null;
  let userDifficultyTier = 1;
  let restartAction = 'next-round';

  function isActive() {
    if (!isEnabled()) return false;
    if (activeMode === '2player') return localSeries.isActive();
    return activeMode != null && currentMode().isActive();
  }

  function currentMode() {
    if (activeMode === 'casual') return casual;
    return tournament;
  }

  function getEffectiveAiTier() {
    if (activeMode === 'casual') return casual.getAiTier();
    const stage = tournament.getOpponentIndex();
    const opp = tournament.getCurrentOpponent();
    const beyTier = opp ? getAiTierForOpponentId(opp.id) : stage;
    return Math.min(Math.max(stage, beyTier), AI_TIER_MAX);
  }

  function setTournamentOpponent() {
    const raw = pickTournamentOpponent(tournament.getOpponentIndex(), getPlayerBey());
    const opp = applyTournamentBladerProfile(raw);
    tournament.setOpponent(opp);
    return opp;
  }

  function rollAndSetOpponent() {
    const playerBey = getPlayerBey();
    if (activeMode === 'casual') {
      const opp = pickRandomRival(playerBey);
      casual.start(opp, userDifficultyTier);
      return opp;
    }
    return setTournamentOpponent();
  }

  function isMobileHud() {
    return document.body.classList.contains('mobile');
  }

  function clearHudClasses() {
    campaignHud?.classList.remove(
      'campaign-hud--tournament',
      'campaign-hud--casual',
      'campaign-hud--local-2p',
      'campaign-hud--series'
    );
  }

  function renderCpuSeriesHud({
    modeLabel,
    metaLine,
    playerWins,
    cpuWins,
    slots,
    ariaLabel,
    tierLine = null,
  }) {
    if (!campaignHud) return;

    clearHudClasses();
    campaignHud.classList.add('campaign-hud--series');
    campaignHud.classList.toggle('campaign-hud--tournament', activeMode === 'tournament');
    campaignHud.classList.toggle('campaign-hud--casual', activeMode === 'casual');

    if (isMobileHud()) {
      campaignHud.innerHTML = `
        <div class="campaign-hud-mobile campaign-hud-mobile--center">
          ${tierLine ? `<div class="campaign-hud-tier">${tierLine}</div>` : ''}
          <div class="campaign-hud-meta">${modeLabel}</div>
          <div class="campaign-hud-series" role="group" aria-label="${ariaLabel}">
            <span class="campaign-series-dots">${seriesDotsHtml(playerWins, cpuWins, slots)}</span>
          </div>
        </div>`;
    } else {
      campaignHud.innerHTML = `
        <div class="campaign-hud-desktop">
          <span class="campaign-hud-meta">${metaLine}</span>
          <span class="campaign-series-dots">${seriesDotsHtml(playerWins, cpuWins, slots)}</span>
        </div>`;
    }

    campaignHud.setAttribute('aria-label', ariaLabel);
    campaignHud.classList.remove('hidden');
  }

  function updateHud() {
    if (!campaignHud) return;
    if (!isActive()) {
      campaignHud.classList.add('hidden');
      campaignHud.textContent = '';
      campaignHud.removeAttribute('aria-label');
      clearHudClasses();
      return;
    }

    if (activeMode === '2player') {
      const { p1, p2 } = localSeries.getSeriesScore();
      const slots = localSeries.getSeriesSlots();
      const winsNeeded = localSeries.getWinsNeeded();

      clearHudClasses();
      campaignHud.classList.add('campaign-hud--local-2p', 'campaign-hud--series');

      if (isMobileHud()) {
        campaignHud.innerHTML = `
          <div class="campaign-hud-mobile campaign-hud-mobile--center">
            <div class="campaign-hud-meta">Best of ${slots}</div>
            ${dualSeriesDotsHtml(p1, p2, p2, p1, slots)}
          </div>`;
      } else {
        campaignHud.innerHTML = `
          <div class="campaign-hud-desktop">
            <span class="campaign-hud-meta">Best of ${slots}</span>
            ${dualSeriesDotsHtml(p1, p2, p2, p1, slots)}
          </div>`;
      }

      campaignHud.setAttribute(
        'aria-label',
        `Local best of ${slots}, player 1 ${p1} wins, player 2 ${p2} wins, first to ${winsNeeded}`
      );
      campaignHud.classList.remove('hidden');
      return;
    }

    const opp = currentMode().getCurrentOpponent();
    const diffLabel = getDifficultyLabel(getEffectiveAiTier());
    const oppName = activeMode === 'tournament' ? getBladerDisplayName(opp) : (opp?.name ?? 'CPU');
    const blader = activeMode === 'tournament' ? getTournamentBlader(opp?.id) : null;

    if (activeMode === 'casual') {
      const { player, cpu } = casual.getSeriesScore();
      const slots = casual.getSeriesSlots();
      renderCpuSeriesHud({
        modeLabel: 'Casual',
        metaLine: `Casual · ${diffLabel} · vs ${oppName}`,
        playerWins: player,
        cpuWins: cpu,
        slots,
        ariaLabel: `Casual best of ${slots}, you ${player} rival ${cpu}, versus ${oppName}`,
      });
      return;
    }

    const { player, cpu } = tournament.getSeriesScore();
    const tier = tournament.getOpponentIndex() + 1;
    const stageCount = tournament.getStageCount();
    const bladerLine = blader ? `${blader.name} (${blader.title})` : oppName;
    const stadiumName = opp?.id ? getArenaSkinForBey(opp.id).name : null;

    renderCpuSeriesHud({
      modeLabel: stadiumName ? `T${tier}/${stageCount} · ${stadiumName}` : `T${tier}/${stageCount}`,
      metaLine: stadiumName
        ? `Tournament ${tier}/${stageCount} · ${stadiumName} · vs ${bladerLine}`
        : `Tournament ${tier}/${stageCount} · ${diffLabel} · vs ${bladerLine}`,
      playerWins: player,
      cpuWins: cpu,
      slots: SERIES_BEST_OF.THREE,
      tierLine: stadiumName ? `T${tier} · ${stadiumName}` : `T${tier}/${stageCount}`,
      ariaLabel: `Tournament ${tier} of ${stageCount}, stadium ${stadiumName ?? 'unknown'}, best of 3, you ${player} rival ${cpu}, versus ${blader?.name ?? opp?.name ?? 'CPU'}`,
    });
  }

  async function beginOpponent({ animateArena = false } = {}) {
    setAIContext({
      tournament: activeMode !== 'casual',
      stageIndex: activeMode === 'tournament' ? tournament.getOpponentIndex() : 0,
      opponentId: currentMode().getCurrentOpponent()?.id ?? null,
    });
    setAIDifficulty(getEffectiveAiTier());
    const opp = currentMode().getCurrentOpponent();
    if (activeMode === 'tournament' && onArenaTransition) {
      await onArenaTransition(opp, { animate: animateArena });
    }
    onOpponentChange(opp);
    updateHud();
  }

  function handleCasualMatchEnd(result) {
    const opp = casual.getCurrentOpponent();
    const oppName = opp?.name ?? 'CPU';
    const isDraw = result.outcome === 'DRAW';

    if (!isDraw) casual.recordMatch(result.winner);

    const { player, cpu } = casual.getSeriesScore();
    const scoreLine = `Series: ${player}–${cpu}`;
    const seriesStatus = casual.getSeriesStatus();
    const winsNeeded = casual.getWinsNeeded();

    if (isDraw) {
      restartAction = 'next-round';
      btnRestart.textContent = 'Rematch';
      gameoverMsg.textContent = `${scoreLine}. Rematch vs ${oppName}.`;
      updateHud();
      return;
    }

    if (seriesStatus === 'ongoing') {
      restartAction = 'next-round';
      btnRestart.textContent = 'Next Round';
      gameoverMsg.textContent = `${scoreLine}. First to ${winsNeeded} wins the series vs ${oppName}.`;
      updateHud();
      return;
    }

    if (seriesStatus === 'cpu') {
      restartAction = 'rematch-same';
      btnRestart.textContent = 'Try Again';
      gameoverTitle.textContent = 'DEFEATED';
      gameoverTitle.className = 'lose';
      gameoverMsg.textContent = `${scoreLine}. ${oppName} takes the series.`;
      updateHud();
      return;
    }

    restartAction = 'rematch-random';
    btnRestart.textContent = 'Next Rival';
    gameoverTitle.textContent = 'SERIES WON!';
    gameoverTitle.className = 'win';
    gameoverMsg.textContent = `${scoreLine}. You beat ${oppName}! A new rival awaits.`;
    updateHud();
  }

  function handleTournamentMatchEnd(result) {
    const isDraw = result.outcome === 'DRAW';
    if (!isDraw) tournament.recordMatch(result.winner);

    const { player, cpu } = tournament.getSeriesScore();
    const scoreLine = `Series: ${player}–${cpu}`;
    const seriesStatus = tournament.getSeriesStatus();
    const opp = tournament.getCurrentOpponent();
    const blader = getTournamentBlader(opp?.id);
    const rivalName = blader?.name ?? opp?.name ?? 'the rival';

    if (isDraw) {
      restartAction = 'next-round';
      btnRestart.textContent = 'Rematch';
      gameoverMsg.textContent = `${scoreLine}. Rematch against ${rivalName}.`;
      updateHud();
      return;
    }

    if (seriesStatus === 'ongoing') {
      restartAction = 'next-round';
      btnRestart.textContent = 'Next Round';
      gameoverMsg.textContent = `${scoreLine}. First to 2 wins the series vs ${rivalName}.`;
      updateHud();
      return;
    }

    if (seriesStatus === 'cpu') {
      restartAction = 'retry-tournament';
      btnRestart.textContent = 'Try Again';
      gameoverTitle.textContent = 'DEFEATED';
      gameoverTitle.className = 'lose';
      gameoverMsg.textContent = `${scoreLine}. ${rivalName} takes the series.`;
      updateHud();
      return;
    }

    if (tournament.isCampaignComplete()) {
      restartAction = 'retry-tournament';
      btnRestart.textContent = 'Play Again';
      gameoverTitle.textContent = 'CHAMPION!';
      gameoverTitle.className = 'win';
      gameoverMsg.textContent = `You defeated Ryuga and conquered the tournament!`;
      campaignHud?.classList.add('hidden');
      return;
    }

    restartAction = 'next-opponent';
    btnRestart.textContent = 'Next Rival';
    gameoverTitle.textContent = 'SERIES WON!';
    gameoverTitle.className = 'win';
    gameoverMsg.textContent = `${scoreLine}. You beat ${rivalName}! The next blader awaits.`;
    const nextRaw = pickTournamentOpponent(tournament.getOpponentIndex() + 1, getPlayerBey());
    if (nextRaw?.model) preloadTopModel(nextRaw.model);
    updateHud();
  }

  function handleLocalMatchEnd(result) {
    const isDraw = result.outcome === 'DRAW';
    if (!isDraw) localSeries.recordMatch(result.winner);

    const { p1, p2 } = localSeries.getSeriesScore();
    const scoreLine = `Series: P1 ${p1}–${p2} P2`;
    const seriesStatus = localSeries.getSeriesStatus();
    const winsNeeded = localSeries.getWinsNeeded();

    if (isDraw) {
      restartAction = 'next-round';
      btnRestart.textContent = 'Rematch';
      gameoverMsg.textContent = `${scoreLine}. Rematch this round.`;
      updateHud();
      return;
    }

    if (seriesStatus === 'ongoing') {
      restartAction = 'next-round';
      btnRestart.textContent = 'Next Round';
      gameoverMsg.textContent = `${scoreLine}. First to ${winsNeeded} wins the series.`;
      updateHud();
      return;
    }

    const winner = seriesStatus === 'p1' ? 1 : 2;
    restartAction = 'retry-local-series';
    btnRestart.textContent = 'New Series';
    gameoverTitle.textContent = `PLAYER ${winner} WINS THE SERIES!`;
    gameoverTitle.className = 'win';
    gameoverMsg.textContent = `${scoreLine}. Player ${winner} takes best of ${localSeries.getSeriesSlots()}.`;
    updateHud();
  }

  function handleMatchEnd(result) {
    if (!isActive()) return;

    if (activeMode === 'casual') {
      handleCasualMatchEnd(result);
      return;
    }

    if (activeMode === '2player') {
      handleLocalMatchEnd(result);
      return;
    }

    handleTournamentMatchEnd(result);
  }

  async function handleRestart(resetGame) {
    if (activeMode === '2player') {
      if (restartAction === 'retry-local-series') {
        localSeries.start();
      }
      await resetGame();
      updateHud();
      return;
    }

    if (activeMode === 'casual') {
      if (restartAction === 'rematch-random') {
        rollAndSetOpponent();
        await beginOpponent();
      } else if (restartAction === 'rematch-same') {
        casual.start(casual.getCurrentOpponent(), userDifficultyTier);
        await beginOpponent();
      }
      resetAIController();
      await resetGame();
      updateHud();
      return;
    }

    if (restartAction === 'retry-tournament') {
      tournament.start(getPlayerBey());
      rollAndSetOpponent();
      await beginOpponent({ animateArena: true });
      resetAIController();
      await resetGame();
      updateHud();
      return;
    }

    if (restartAction === 'next-opponent') {
      tournament.advanceOpponent();
      rollAndSetOpponent();
      await beginOpponent({ animateArena: true });
      resetAIController();
      await resetGame();
      updateHud();
      return;
    }

    resetAIController();
    await resetGame();
    updateHud();
  }

  return {
    tournament,
    casual,
    localSeries,
    updateHud,
    beginOpponent,
    handleMatchEnd,
    handleRestart,
    startTournament(playerBey) {
      activeMode = 'tournament';
      tournament.start(playerBey);
      setTournamentOpponent();
      // First rival: apply skin quietly (select/start overlays still up).
      return beginOpponent({ animateArena: false });
    },
    startCasual(playerBey, difficulty) {
      activeMode = 'casual';
      userDifficultyTier = difficulty ?? 1;
      const opp = pickRandomRival(playerBey);
      casual.start(opp, userDifficultyTier);
      return beginOpponent();
    },
    startLocalSeries() {
      activeMode = '2player';
      localSeries.start();
      updateHud();
    },
    resetCampaign() {
      activeMode = null;
      setAIContext({ tournament: false });
      tournament.reset();
      casual.reset();
      localSeries.reset();
      updateHud();
    },
    handlesRestart() {
      return isActive();
    },
    /** Play the Entering-stadium reveal for the current tournament rival. */
    async revealArenaForCurrentOpponent() {
      if (activeMode !== 'tournament' || !onArenaTransition) return;
      const opp = tournament.getCurrentOpponent();
      if (!opp) return;
      await onArenaTransition(opp, { animate: true });
    },
    /** @deprecated Use startTournament */
    startCampaign() {
      return this.startTournament(getPlayerBey());
    },
  };
}
