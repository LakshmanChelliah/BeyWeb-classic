import { getBeyById } from './beys.js';
import { pickRandomRival } from './campaign.js';
import { createSeriesTracker, SERIES_BEST_OF } from './seriesScore.js';

/** Best-of-3 casual fights — CPU rival is rolled randomly each series. */
export function createCasualMode() {
  const series = createSeriesTracker(SERIES_BEST_OF.THREE);
  let opponentId = null;
  let difficultyTier = 1;
  let active = false;

  return {
    start(opponentBey, difficulty) {
      opponentId = opponentBey?.id ?? null;
      difficultyTier = difficulty ?? 1;
      active = Boolean(opponentId);
      series.reset();
    },

    reset() {
      opponentId = null;
      difficultyTier = 1;
      active = false;
      series.reset();
    },

    isActive() {
      return active;
    },

    getAiTier() {
      return difficultyTier;
    },

    setDifficulty(tier) {
      difficultyTier = tier;
    },

    rollOpponent(playerBey) {
      const opp = pickRandomRival(playerBey);
      opponentId = opp?.id ?? null;
      series.reset();
      return opp;
    },

    getCurrentOpponent() {
      return getBeyById(opponentId);
    },

    recordMatch(winner) {
      series.recordMatch(winner);
    },

    getSeriesScore() {
      const { side1, side2 } = series.getScore();
      return { player: side1, cpu: side2 };
    },

    /** @returns {'ongoing'|'player'|'cpu'} */
    getSeriesStatus() {
      const status = series.getSeriesStatus();
      if (status === 'side1') return 'player';
      if (status === 'side2') return 'cpu';
      return 'ongoing';
    },

    getSeriesSlots() {
      return SERIES_BEST_OF.THREE;
    },

    getWinsNeeded() {
      return series.getWinsNeeded();
    },
  };
}
