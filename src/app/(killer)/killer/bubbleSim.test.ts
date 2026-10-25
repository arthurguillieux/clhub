import { describe, expect, it } from "vitest";
import { MAX_BLOBS, MIN_BLOBS, project, spawnBlob, stepBlobs, type World } from "./bubbleSim";

/** Seeded dice, so a failure can be replayed. */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const onScreen = (b: ReturnType<typeof spawnBlob>, w: World) => {
  const p = project(b, w);
  return p.x + p.r > 0 && p.x - p.r < w.width && p.y + p.r > 0 && p.y - p.r < w.height;
};

describe("the TV's water drops over a whole evening", () => {
  it("are still there, on screen, at a sane speed after three hours (648 000 frames)", () => {
    const world: World = { width: 1920, height: 1080, random: seeded(24) };
    const blobs = Array.from({ length: 12 }, () => spawnBlob(world));
    const cap = 1080 * 0.0016; // the cruising-speed cap, px per frame
    let fewestVisible = Infinity;
    let fastest = 0;
    let fastestCruise = 0;
    for (let frame = 1; frame <= 3 * 3600 * 60; frame++) {
      stepBlobs(blobs, world);
      if (frame % 600 === 0) {
        expect(blobs.length).toBeGreaterThanOrEqual(MIN_BLOBS);
        expect(blobs.length).toBeLessThanOrEqual(MAX_BLOBS);
        for (const b of blobs) {
          expect(Number.isFinite(b.u) && Number.isFinite(b.v) && Number.isFinite(b.z) && b.r > 0).toBe(true);
          fastest = Math.max(fastest, Math.hypot(b.vu, b.vv));
          fastestCruise = Math.max(fastestCruise, b.cruise);
        }
        fewestVisible = Math.min(fewestVisible, blobs.filter((b) => onScreen(b, world)).length);
      }
    }
    expect(fewestVisible).toBeGreaterThanOrEqual(4);
    // Cruising speeds never pass the cap; a split's push can briefly go faster, then fades.
    expect(fastestCruise).toBeLessThanOrEqual(cap);
    expect(fastest).toBeLessThan(cap * 3.6);
  }, 120_000);

  it("wait out a screen that drops to zero size, then carry on", () => {
    const world: World = { width: 1920, height: 1080, random: seeded(7) };
    const blobs = Array.from({ length: 12 }, () => spawnBlob(world));
    world.width = 0;
    world.height = 0;
    for (let i = 0; i < 100; i++) stepBlobs(blobs, world);
    world.width = 1920;
    world.height = 1080;
    for (let i = 0; i < 1000; i++) stepBlobs(blobs, world);
    expect(blobs.every((b) => Number.isFinite(b.u) && Number.isFinite(b.v))).toBe(true);
  });

  it("replace a drop that has gone wrong instead of carrying a broken number around", () => {
    const world: World = { width: 1280, height: 720, random: seeded(3) };
    const blobs = Array.from({ length: 12 }, () => spawnBlob(world));
    blobs[0]!.u = Number.NaN;
    blobs[1]!.v = 1e9;
    stepBlobs(blobs, world);
    expect(blobs.every((b) => Number.isFinite(b.u) && Math.abs(b.v) < 5000)).toBe(true);
  });
});
