/**
 * The launch countdown, calibrated on Arthur's 15-second file: a cannon shot every second, "10" on
 * the shot at 1 s, "9" at 2 s … "0" at 11 s, then four seconds of ambiance while the game begins.
 * Times are seconds since the countdown started (on the TV: since its sound started).
 */
export const COUNTDOWN_FROM = 10;
/** The "0": the game starts, phones show « Voir ma cible ». */
export const COUNTDOWN_ZERO_S = COUNTDOWN_FROM + 1;
/** The TV leaves the countdown screen for the arena this long after the « 0 »; the sound plays on to its end. */
export const LEAVE_AFTER_ZERO_S = 1.2;
export const COUNTDOWN_LEAVE_S = COUNTDOWN_ZERO_S + LEAVE_AFTER_ZERO_S;

/** What the countdown shows `elapsed` seconds in: null before the first shot, then 10, 9 … 0. */
export function countdownNumber(elapsed: number): number | null {
  if (elapsed < 1) return null;
  return Math.max(0, COUNTDOWN_FROM + 1 - Math.floor(elapsed));
}

/** The shots on the whole seconds — the synthesised countdown, or a file whose shots couldn't be found. */
export const WHOLE_SECOND_SHOTS: readonly number[] = Array.from({ length: COUNTDOWN_ZERO_S }, (_, i) => i + 1);

/** Same, against the actual times of the shots: null before the first, then 10, 9 … 0, one per shot. */
export function countdownNumberAt(elapsed: number, shots: readonly number[]): number | null {
  const passed = shots.filter((s) => elapsed >= s).length;
  return passed === 0 ? null : Math.max(0, shots.length - passed);
}

/**
 * Finds when to show 10, 9 … 0 in the organizer's countdown file, so each number lands on the start
 * of its cannon shot. The file has a shot every second, regularly, but not necessarily on the whole
 * seconds: in Arthur's, each boom starts 0.15 s before the second, and the « 0 » follows the tenth
 * as the ambiance starts.
 *
 * So rather than chasing each boom (they rumble, with several swells, some with a soft lead-in),
 * this looks for the one offset that best lines a once-a-second grid up with the attacks of the
 * whole file: the rise in loudness over 20 ms (in decades, so a quiet start counts as much as a
 * loud one), summed over the ten shots, for offsets from −0.45 s to +0.45 s. Null if no offset
 * clearly wins — the file doesn't tick every second — and the numbers then stick to whole seconds.
 */
export function findShots(samples: Float32Array, sampleRate: number): number[] | null {
  const hop = Math.max(1, Math.round(sampleRate * 0.005));
  const frames = Math.floor(samples.length / hop);
  const level = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let sum = 0;
    for (let i = f * hop; i < (f + 1) * hop; i++) sum += samples[i]! * samples[i]!;
    level[f] = Math.log10(sum / hop + 1e-9);
  }
  const attack = new Float32Array(frames);
  for (let f = 4; f < frames; f++) attack[f] = Math.max(0, level[f]! - level[f - 4]!);
  const frameAt = (t: number) => Math.min(frames - 1, Math.max(0, Math.round((t * sampleRate) / hop)));

  const scores: { offset: number; score: number }[] = [];
  for (let ms = -450; ms <= 450; ms += 5) {
    const offset = ms / 1000;
    let score = 0;
    for (let k = 1; k <= COUNTDOWN_FROM; k++) {
      let strongest = 0;
      for (let j = -2; j <= 2; j++) strongest = Math.max(strongest, attack[frameAt(k + offset) + j] ?? 0);
      score += strongest;
    }
    scores.push({ offset, score });
  }
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));
  const runnerUp = Math.max(0, ...scores.filter((s) => Math.abs(s.offset - best.offset) > 0.08).map((s) => s.score));
  if (best.score <= 0 || best.score < runnerUp * 1.2) return null;
  return WHOLE_SECOND_SHOTS.map((s) => s + best.offset);
}
