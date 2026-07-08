/** Shared best-of series dot UI and helpers. */

export const SERIES_BEST_OF = Object.freeze({
  THREE: 3,
  FIVE: 5,
});

export function winsNeededForBestOf(bestOf) {
  return Math.ceil(bestOf / 2);
}

export function seriesDotsHtml(wins, losses, total = SERIES_BEST_OF.THREE) {
  const parts = [];
  for (let i = 0; i < total; i++) {
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

export function dualSeriesDotsHtml(p1Wins, p1Losses, p2Wins, p2Losses, total = SERIES_BEST_OF.FIVE) {
  return `
    <div class="campaign-hud-series campaign-hud-series--stacked" role="group" aria-label="Best of ${total} series score">
      <div class="campaign-series-side">
        <span class="campaign-series-tag">P1</span>
        <span class="campaign-series-dots">${seriesDotsHtml(p1Wins, p1Losses, total)}</span>
      </div>
      <div class="campaign-series-side">
        <span class="campaign-series-tag">P2</span>
        <span class="campaign-series-dots">${seriesDotsHtml(p2Wins, p2Losses, total)}</span>
      </div>
    </div>`;
}

export function createSeriesTracker(bestOf = SERIES_BEST_OF.THREE) {
  const winsNeeded = winsNeededForBestOf(bestOf);
  let side1Wins = 0;
  let side2Wins = 0;

  return {
    getBestOf() {
      return bestOf;
    },

    getWinsNeeded() {
      return winsNeeded;
    },

    reset() {
      side1Wins = 0;
      side2Wins = 0;
    },

    recordMatch(winner) {
      if (winner === 1) side1Wins += 1;
      else if (winner === 2) side2Wins += 1;
    },

    getScore() {
      return { side1: side1Wins, side2: side2Wins };
    },

    /** @returns {'ongoing'|'side1'|'side2'} */
    getSeriesStatus() {
      if (side1Wins >= winsNeeded) return 'side1';
      if (side2Wins >= winsNeeded) return 'side2';
      return 'ongoing';
    },
  };
}
