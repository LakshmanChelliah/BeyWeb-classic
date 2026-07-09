/** PC / mobile play modes. */
export const GAME_MODES = Object.freeze({
  CASUAL: 'casual',
  TOURNAMENT: 'tournament',
  TWO_PLAYER: '2player',
});

export function isVsCpu(mode) {
  return mode === GAME_MODES.CASUAL || mode === GAME_MODES.TOURNAMENT;
}

export function modeBlurb(mode) {
  switch (mode) {
    case GAME_MODES.CASUAL:
      return 'Casual: best of 3 vs a random CPU rival. Win the series, then face a new rival.';
    case GAME_MODES.TOURNAMENT:
      return 'Tournament: best of 3 vs seven bladers in rising order — Benkei to Masamune.';
    default:
      return 'Two-player local battle — best of 5. P1: WASD + Q/E. P2: arrows + N/M';
  }
}
