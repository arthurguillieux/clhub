import { describe, expect, it } from "vitest";
import { COUNTDOWN_LEAVE_S, COUNTDOWN_ZERO_S, WHOLE_SECOND_SHOTS, countdownNumber, countdownNumberAt, findShots } from "./countdown";

/**
 * A fake 15 s countdown file like Arthur's: faint hiss, a boom (low rumble, sharp attack, decaying)
 * at each given time, and a soft ambiance a second after the last one.
 */
function fakeCountdown(shotTimes: number[], rate = 8000): Float32Array {
  const samples = new Float32Array(15 * rate);
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < samples.length; i++) samples[i] = noise() * 0.01;
  for (const t of shotTimes) {
    const start = Math.round(t * rate);
    for (let i = 0; i < 0.6 * rate && start + i < samples.length; i++) {
      const envelope = Math.min(1, i / (0.01 * rate)) * Math.exp(-i / (0.15 * rate));
      samples[start + i]! += (Math.sin((2 * Math.PI * 55 * i) / rate) * 0.8 + noise() * 0.2) * envelope;
    }
  }
  const ambiance = Math.round((shotTimes[shotTimes.length - 1]! + 1.5) * rate);
  for (let i = ambiance; i < samples.length; i++) samples[i]! += noise() * 0.05;
  return samples;
}

describe("launch countdown", () => {
  it("shows nothing before the first shot, then 10 at 1 s, 9 at 2 s … 0 at 11 s", () => {
    expect(countdownNumber(0)).toBeNull();
    expect(countdownNumber(0.99)).toBeNull();
    expect(countdownNumber(1)).toBe(10);
    expect(countdownNumber(1.9)).toBe(10);
    expect(countdownNumber(2)).toBe(9);
    expect(countdownNumber(10)).toBe(1);
    expect(countdownNumber(11)).toBe(0);
    expect(countdownNumber(14)).toBe(0);
  });

  it("starts the game at 11 s and leaves the TV screen soon after, while the 15 s sound plays on", () => {
    expect(COUNTDOWN_ZERO_S).toBe(11);
    expect(COUNTDOWN_LEAVE_S).toBeGreaterThan(11);
    expect(COUNTDOWN_LEAVE_S).toBeLessThan(15);
  });
});

describe("finding the shots in a countdown file", () => {
  const tenBooms = (shift: number) => WHOLE_SECOND_SHOTS.slice(0, 10).map((s) => s + shift);

  it("lines up on ten booms that start 0.15 s before each second (Arthur's file), the 0 a second after the last", () => {
    const booms = tenBooms(-0.15);
    const found = findShots(fakeCountdown(booms), 8000);
    expect(found).toHaveLength(11);
    booms.forEach((t, i) => expect(Math.abs(found![i]! - t)).toBeLessThan(0.011));
    expect(Math.abs(found![10]! - (booms[9]! + 1))).toBeLessThan(0.011);
  });

  it("lines up on booms that come a little after each second too", () => {
    const booms = tenBooms(0.2);
    const found = findShots(fakeCountdown(booms), 8000);
    booms.forEach((t, i) => expect(Math.abs(found![i]! - t)).toBeLessThan(0.011));
  });

  it("isn't thrown by a stray sound between two booms", () => {
    const booms = tenBooms(-0.15);
    const samples = fakeCountdown(booms);
    for (let i = Math.round(4.4 * 8000); i < 4.5 * 8000; i++) samples[i]! += Math.sin(i) * 0.9; // a clap mid-second
    const found = findShots(samples, 8000);
    booms.forEach((t, i) => expect(Math.abs(found![i]! - t)).toBeLessThan(0.011));
  });

  it("gives up on a file with no clear shots, so the numbers stick to whole seconds", () => {
    const flat = new Float32Array(15 * 8000).map((_, i) => Math.sin(i / 7) * 0.3);
    expect(findShots(flat, 8000)).toBeNull();
  });

  it("shows one number per shot: 10 on the first, 0 on the eleventh", () => {
    const shots = WHOLE_SECOND_SHOTS.map((s) => s - 0.13);
    expect(countdownNumberAt(0.86, shots)).toBeNull();
    expect(countdownNumberAt(0.87, shots)).toBe(10);
    expect(countdownNumberAt(1.87, shots)).toBe(9);
    expect(countdownNumberAt(10.87, shots)).toBe(0);
  });
});
