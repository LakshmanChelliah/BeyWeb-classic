import { createSeriesTracker, SERIES_BEST_OF } from './seriesScore.js';

/** Local two-player best-of-5 series state. */
export function createLocalSeriesMode() {
  const series = createSeriesTracker(SERIES_BEST_OF.FIVE);
  let active = false;

  return {
    start() {
      series.reset();
      active = true;
    },

    reset() {
      series.reset();
      active = false;
    },

    isActive() {
      return active;
    },

    recordMatch(winner) {
      series.recordMatch(winner);
    },

    getSeriesScore() {
      const { side1, side2 } = series.getScore();
      return { p1: side1, p2: side2 };
    },

    getSeriesStatus() {
      const status = series.getSeriesStatus();
      if (status === 'side1') return 'p1';
      if (status === 'side2') return 'p2';
      return 'ongoing';
    },

    getSeriesSlots() {
      return SERIES_BEST_OF.FIVE;
    },

    getWinsNeeded() {
      return series.getWinsNeeded();
    },
  };
}
