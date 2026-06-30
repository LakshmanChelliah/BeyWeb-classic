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
import { preloadTopModel } from '../render/modelCache.js';

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
  getPlayerBey = () => null,
}) {
  const tournament = createCampaign();
  const casual = createCasualMode();
  let activeMode = null;
  let userDifficultyTier = 1;
  let restartAction = 'next-round';

  function isActive() {
    return isEnabled() && activeMode != null && currentMode().isActive();
  }

  function currentMode() {
    return activeMode === 'casual' ? casual : tournament;
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

  function seriesDotsHtml(wins, losses) {
    const parts = [];
    for (let i = 0; i < 3; i++) {
      if (i < wins) {
        parts.push('<span class="campaign-dot campaign-dot--win" aria-hidden="true"></span>');
      } else if (i < wins + losses) {
        parts.push('<span class="campaign-dot campaign-dot--loss" aria-hidden="true"></span>');
      } else {
        parts.push('<span class="campaign-dot campaign-dot--pending" aria-hidden="true"></span>');
      }
    }
    return parts.join('');
  }

  function isMobileHud() {
    return document.body.classList.contains('mobile');
  }

  function updateHud() {
    if (!campaignHud) return;
    if (!isActive()) {
      campaignHud.classList.add('hidden');
      campaignHud.textContent = '';
      campaignHud.removeAttribute('aria-label');
      return;
    }

    const opp = currentMode().getCurrentOpponent();
    const diffLabel = getDifficultyLabel(getEffectiveAiTier());
    const oppName = activeMode === 'tournament' ? getBladerDisplayName(opp) : (opp?.name ?? 'CPU');
    const blader = activeMode === 'tournament' ? getTournamentBlader(opp?.id) : null;

    if (activeMode === 'casual') {
      campaignHud.textContent = `Casual · ${diffLabel} · vs ${oppName}`;
      campaignHud.classList.remove('hidden', 'campaign-hud--tournament');
      return;
    }

    const { player, cpu } = tournament.getSeriesScore();
    const tier = tournament.getOpponentIndex() + 1;
    const stageCount = tournament.getStageCount();

    if (isMobileHud()) {
      campaignHud.classList.add('campaign-hud--tournament');
      campaignHud.innerHTML = `
        <div class="campaign-hud-mobile campaign-hud-mobile--center">
          <div class="campaign-hud-tier">T${tier}/${stageCount}</div>
          <div class="campaign-hud-series" role="group" aria-label="Your best of 3 series score">
            <span class="campaign-series-dots">${seriesDotsHtml(player, cpu)}</span>
          </div>
        </div>`;
      campaignHud.setAttribute(
        'aria-label',
        `Tournament ${tier} of ${stageCount}, best of 3, you ${player} rival ${cpu}, versus ${blader?.name ?? opp?.name ?? 'CPU'}`
      );
    } else {
      campaignHud.classList.remove('campaign-hud--tournament');
      const bladerLine = blader ? `${blader.name} (${blader.title})` : oppName;
      campaignHud.textContent =
        `Tournament ${tier}/${stageCount} · Best of 3: ${player}–${cpu} · ${diffLabel} · vs ${bladerLine}`;
      campaignHud.setAttribute(
        'aria-label',
        `Tournament ${tier} of ${stageCount}, series ${player} to ${cpu}, versus ${blader?.name ?? opp?.name ?? 'CPU'}`
      );
    }

    campaignHud.classList.remove('hidden');
  }

  function beginOpponent() {
    setAIContext({
      tournament: activeMode !== 'casual',
      stageIndex: activeMode === 'tournament' ? tournament.getOpponentIndex() : 0,
      opponentId: currentMode().getCurrentOpponent()?.id ?? null,
    });
    setAIDifficulty(getEffectiveAiTier());
    const opp = currentMode().getCurrentOpponent();
    onOpponentChange(opp);
    updateHud();
  }

  function handleCasualMatchEnd(result) {
    const opp = casual.getCurrentOpponent();
    const oppName = opp?.name ?? 'CPU';

    if (result.outcome === 'DRAW') {
      restartAction = 'rematch-same';
      btnRestart.textContent = 'Rematch';
      gameoverMsg.textContent = `Draw vs ${oppName}. Fight again!`;
      return;
    }

    if (result.winner === 1) {
      restartAction = 'rematch-random';
      btnRestart.textContent = 'Next Rival';
      gameoverTitle.textContent = 'VICTORY!';
      gameoverTitle.className = 'win';
      gameoverMsg.textContent = `You defeated ${oppName}! Next rival is random.`;
    } else {
      restartAction = 'rematch-same';
      btnRestart.textContent = 'Try Again';
      gameoverTitle.textContent = 'DEFEATED';
      gameoverTitle.className = 'lose';
      gameoverMsg.textContent = `${oppName} wins. Try again!`;
    }
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
      campaignHud?.classList.add('hidden');
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
    if (nextRaw?.model) preloadTopModel(nextRaw.model, undefined, nextRaw.modelMeta);
  }

  function handleMatchEnd(result) {
    if (!isActive()) return;

    if (activeMode === 'casual') {
      handleCasualMatchEnd(result);
      return;
    }

    handleTournamentMatchEnd(result);
  }

  async function handleRestart(resetGame) {
    if (activeMode === 'casual') {
      if (restartAction === 'rematch-random') {
        rollAndSetOpponent();
        beginOpponent();
      }
      resetAIController();
      await resetGame();
      return;
    }

    if (restartAction === 'retry-tournament') {
      tournament.start(getPlayerBey());
      rollAndSetOpponent();
      beginOpponent();
      resetAIController();
      await resetGame();
      return;
    }

    if (restartAction === 'next-opponent') {
      tournament.advanceOpponent();
      rollAndSetOpponent();
      beginOpponent();
      resetAIController();
      await resetGame();
      return;
    }

    resetAIController();
    await resetGame();
  }

  return {
    tournament,
    casual,
    updateHud,
    beginOpponent,
    handleMatchEnd,
    handleRestart,
    startTournament(playerBey) {
      activeMode = 'tournament';
      tournament.start(playerBey);
      setTournamentOpponent();
      beginOpponent();
    },
    startCasual(playerBey, difficulty) {
      activeMode = 'casual';
      userDifficultyTier = difficulty ?? 1;
      const opp = pickRandomRival(playerBey);
      casual.start(opp, userDifficultyTier);
      beginOpponent();
    },
    resetCampaign() {
      activeMode = null;
      setAIContext({ tournament: false });
      tournament.reset();
      casual.reset();
      updateHud();
    },
    handlesRestart() {
      return isActive();
    },
    /** @deprecated Use startTournament */
    startCampaign() {
      this.startTournament(getPlayerBey());
    },
  };
}
