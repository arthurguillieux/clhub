/**
 * The launch countdown, calibrated on Arthur's 15-second file: a cannon shot every second, "10" on
 * the shot at 1 s, "9" at 2 s … "0" at 11 s, then four seconds of ambiance while the game begins.
 * Times are seconds since the countdown started (on the TV: since its sound started).
 */
export const COUNTDOWN_FROM = 10;
/** The "0": the game starts, phones show « Voir ma cible ». */
export const COUNTDOWN_ZERO_S = COUNTDOWN_FROM + 1;
/** The TV leaves the countdown screen for the arena here; the sound plays on to its end. */
export const COUNTDOWN_LEAVE_S = COUNTDOWN_ZERO_S + 1.2;

/** What the countdown shows `elapsed` seconds in: null before the first shot, then 10, 9 … 0. */
export function countdownNumber(elapsed: number): number | null {
  if (elapsed < 1) return null;
  return Math.max(0, COUNTDOWN_FROM + 1 - Math.floor(elapsed));
}
