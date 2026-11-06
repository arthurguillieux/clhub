"use client";

import { useEffect, useRef } from "react";
import { COLUMN, driftCaps, land, ledgeCaps, newPile, resized, type Pile } from "./snowPile";

/** What snow settles on. `.santa-ledge` marks anything else than a panel, like the lid of the gift. */
const LEDGES = ".santa-panel, .santa-ledge";

/** How far a pile reaches over the top of its ledge, so it sits on it instead of hovering. */
const OVERLAP = 4;

const LEDGE_HEIGHT = 15;

/** How often the page is checked for ledges that moved, appeared or left. */
const CHECK_EVERY_MS = 200;

interface Ledge {
  x: number;
  y: number;
  width: number;
  pile: Pile;
}

interface Flake {
  x: number;
  y: number;
  r: number;
  fall: number;
  sway: number;
  alpha: number;
  /** Near flakes settle on the panels; the others fall behind them, down to the drift. */
  near: boolean;
}

/** A bit of snow shaken off a ledge that left the page. */
interface Puff {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
}

/** A soft white dot, drawn once: real flakes have no hard edge. */
function flakeSprite(): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 32;
  const ctx = sprite.getContext("2d")!;
  const glow = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  glow.addColorStop(0, "rgba(255, 255, 255, 1)");
  glow.addColorStop(0.45, "rgba(255, 255, 255, 0.85)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 32, 32);
  return sprite;
}

function tracePile(ctx: CanvasRenderingContext2D, heights: Float32Array, x: number, y: number, depth: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + depth);
  let px = x;
  let py = y - heights[0]!;
  ctx.lineTo(px, py);
  for (let i = 1; i < heights.length; i++) {
    const nx = x + i * COLUMN;
    const ny = y - heights[i]!;
    ctx.quadraticCurveTo(px, py, (px + nx) / 2, (py + ny) / 2);
    px = nx;
    py = ny;
  }
  ctx.lineTo(px, py);
  ctx.lineTo(px, y + depth);
  ctx.closePath();
}

/**
 * The snow of the « Noël blanc » theme: flakes that really land, piling up on the panels and banking
 * up at the bottom of the window. Two canvases, because they don't move alike: the piles are drawn on
 * one that covers the whole page, so they scroll with their panels without lagging a frame behind,
 * and only get repainted when snow lands; the flakes and the drift are on one fixed to the window.
 * Decorative: neither takes a click, and with reduced motion the snow simply lies there.
 */
export function WinterSnow() {
  const pilesRef = useRef<HTMLCanvasElement>(null);
  const airRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const pilesCanvas = pilesRef.current;
    const airCanvas = airRef.current;
    const page = pilesCanvas?.parentElement;
    const pilesCtx = pilesCanvas?.getContext("2d");
    const airCtx = airCanvas?.getContext("2d");
    if (!pilesCanvas || !airCanvas || !page || !pilesCtx || !airCtx) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const scale = Math.min(2, window.devicePixelRatio || 1);
    const sprite = flakeSprite();

    let width = 0;
    let height = 0;
    let floor = 0;
    let drift: Pile = { heights: new Float32Array(2), caps: new Float32Array(2) };
    let flakes: Flake[] = [];
    const puffs: Puff[] = [];
    const ledges = new Map<Element, Ledge>();
    const dirty = new Set<Ledge>();

    const newFlake = (i: number, anywhere: boolean): Flake => {
      const near = i % 2 === 0;
      return {
        x: Math.random() * width,
        y: anywhere ? Math.random() * height : -6 - Math.random() * 60,
        r: near ? 1.6 + Math.random() * 2.2 : 0.8 + Math.random() * 1,
        fall: near ? 0.75 + Math.random() * 0.6 : 0.35 + Math.random() * 0.3,
        sway: Math.random() * Math.PI * 2,
        alpha: near ? 0.7 + Math.random() * 0.3 : 0.45 + Math.random() * 0.3,
        near,
      };
    };

    const fitAir = () => {
      const w = airCanvas.offsetWidth;
      const h = airCanvas.offsetHeight;
      if (w < 20 || h < 20 || (w === width && h === height)) return;
      const first = width === 0;
      airCanvas.width = w * scale;
      airCanvas.height = h * scale;
      airCtx.setTransform(scale, 0, 0, scale, 0, 0);
      const changedWidth = w !== width;
      width = w;
      height = h;
      if (first) {
        drift = newPile(driftCaps(w, driftHeight()), still ? 0.8 : 0.45, Math.random);
        flakes = Array.from({ length: Math.max(36, Math.min(130, Math.round((w * h) / 9000))) }, (_, i) => newFlake(i, true));
      } else if (changedWidth) {
        drift = resized(drift, driftCaps(w, driftHeight()));
      }
    };

    const bar = () => page.querySelector(".santa-bar");
    const driftHeight = () => (bar() ? 26 : Math.max(38, Math.min(84, height * 0.085)));

    const paintPile = ({ x, y, width: w, pile }: Ledge) => {
      pilesCtx.clearRect(x - 8, y - LEDGE_HEIGHT - 10, w + 16, LEDGE_HEIGHT + OVERLAP + 20);
      const snow = pilesCtx.createLinearGradient(0, y - LEDGE_HEIGHT, 0, y + OVERLAP);
      snow.addColorStop(0, "#ffffff");
      snow.addColorStop(0.7, "#f8fbfd");
      snow.addColorStop(1, "#e4edf3");
      pilesCtx.fillStyle = snow;
      pilesCtx.shadowColor = "rgba(58, 92, 116, 0.28)";
      pilesCtx.shadowBlur = 5;
      pilesCtx.shadowOffsetY = 1.5;
      tracePile(pilesCtx, pile.heights, x, y, OVERLAP);
      pilesCtx.fill();
    };

    const paintAllPiles = () => {
      pilesCtx.clearRect(0, 0, pilesCanvas.width, pilesCanvas.height);
      ledges.forEach(paintPile);
    };

    const shakeOff = ({ x, y, pile }: Ledge) => {
      for (let i = 0; i < pile.heights.length && puffs.length < 160; i += 5) {
        if (pile.heights[i]! < 2) continue;
        puffs.push({ x: x + i * COLUMN, y: y - Math.random() * pile.heights[i]!, vx: (Math.random() - 0.5) * 2.2, vy: -0.4 - Math.random() * 1.6, r: 1 + Math.random() * 2.4, life: 1 });
      }
    };

    /** Follows the page: ledges that moved, came or went, and the size of what's drawn. */
    const check = () => {
      fitAir();
      if (!width) return; // not laid out yet: the next check will do
      const box = page.getBoundingClientRect();
      const w = page.offsetWidth;
      const h = page.offsetHeight;
      let redraw = false;
      if (pilesCanvas.dataset.size !== `${w}x${h}`) {
        pilesCanvas.dataset.size = `${w}x${h}`;
        // A phone can't hold a very tall canvas at double resolution.
        const pileScale = w * h * scale * scale > 12e6 ? 1 : scale;
        pilesCanvas.width = w * pileScale;
        pilesCanvas.height = h * pileScale;
        pilesCtx.setTransform(pileScale, 0, 0, pileScale, 0, 0);
        redraw = true;
      }

      const bare = ledges.size === 0;
      const seen = new Set<Element>();
      for (const el of page.querySelectorAll(LEDGES)) {
        // Panels still coming in have no snow yet: it would hang in the air, a step behind them.
        if (el.closest("[role='dialog'], .santa-arrive")) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 24) continue;
        seen.add(el);
        const x = r.left - box.left;
        const y = r.top - box.top;
        const known = ledges.get(el);
        if (!known) {
          ledges.set(el, { x, y, width: r.width, pile: newPile(ledgeCaps(r.width, LEDGE_HEIGHT), still ? 0.75 : 0.32, Math.random) });
          redraw = true;
        } else if (Math.abs(known.x - x) > 0.5 || Math.abs(known.y - y) > 0.5 || Math.abs(known.width - r.width) > 0.5) {
          if (Math.abs(known.width - r.width) > 0.5) known.pile = resized(known.pile, ledgeCaps(r.width, LEDGE_HEIGHT));
          known.x = x;
          known.y = y;
          known.width = r.width;
          redraw = true;
        }
      }
      for (const [el, ledge] of ledges) {
        if (seen.has(el)) continue;
        ledges.delete(el);
        shakeOff({ ...ledge, y: ledge.y + box.top });
        redraw = true;
      }
      if (redraw) paintAllPiles();
      if (bare && ledges.size > 0 && !still) pilesCanvas.animate({ opacity: [0, 1] }, 900);

      const barTop = bar()?.getBoundingClientRect().top;
      floor = barTop ?? height;
      const cap = driftHeight();
      if (Math.abs((drift.caps[0] ?? 0) - cap) > 1) drift = resized(drift, driftCaps(width, cap));
    };

    const paintAir = () => {
      if (!width) return;
      airCtx.clearRect(0, 0, width, height);
      for (const f of flakes) {
        airCtx.globalAlpha = f.alpha;
        airCtx.drawImage(sprite, f.x - f.r * 1.5, f.y - f.r * 1.5, f.r * 3, f.r * 3);
      }
      for (const p of puffs) {
        airCtx.globalAlpha = Math.max(0, p.life);
        airCtx.drawImage(sprite, p.x - p.r * 1.5, p.y - p.r * 1.5, p.r * 3, p.r * 3);
      }
      airCtx.globalAlpha = 1;
      // The drift: a pale rim behind, for the depth of the bank, and the snow itself in front.
      const top = floor - Math.max(...drift.caps);
      airCtx.fillStyle = "rgba(206, 222, 233, 0.5)";
      tracePile(airCtx, drift.heights, 0, floor - 2.5, 4);
      airCtx.fill();
      const snow = airCtx.createLinearGradient(0, top, 0, floor);
      snow.addColorStop(0, "#ffffff");
      snow.addColorStop(1, "#edf3f7");
      airCtx.fillStyle = snow;
      tracePile(airCtx, drift.heights, 0, floor, 4);
      airCtx.fill();
    };

    let frame = 0;
    let last = performance.now();
    let checked = 0;
    const loop = (now: number) => {
      frame = requestAnimationFrame(loop); // first, so a frame that fails can't stop the snow
      const step = Math.min(3, (now - last) / 16.7);
      last = now;
      if (now - checked > CHECK_EVERY_MS) {
        checked = now;
        check();
      }
      const box = page.getBoundingClientRect();
      const wind = Math.sin(now * 0.00023) * 0.32 + Math.sin(now * 0.00071) * 0.16;

      flakes.forEach((f, i) => {
        const before = f.y;
        f.sway += 0.012 * step;
        f.y += f.fall * step;
        f.x += (Math.sin(f.sway) * 0.32 + wind * (f.near ? 1.3 : 0.7)) * step;
        if (f.x < -6) f.x += width + 12;
        else if (f.x > width + 6) f.x -= width + 12;

        if (f.near) {
          for (const ledge of ledges.values()) {
            const along = f.x - box.left - ledge.x;
            if (along < 0 || along >= ledge.width) continue;
            const column = Math.floor(along / COLUMN);
            const surface = box.top + ledge.y - ledge.pile.heights[column]!;
            // Some flakes slip past, or the panels further down would stay sheltered by the first one.
            if (before > surface || f.y < surface || Math.random() > 0.55) continue;
            land(ledge.pile, column, f.r * 0.6);
            dirty.add(ledge);
            flakes[i] = newFlake(i, false);
            return;
          }
        }
        const column = Math.min(drift.heights.length - 1, Math.max(0, Math.floor(f.x / COLUMN)));
        if (f.y >= floor - drift.heights[column]!) {
          land(drift, column, f.r * 0.5);
          flakes[i] = newFlake(i, false);
        }
      });

      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]!;
        p.vy += 0.07 * step;
        p.x += p.vx * step;
        p.y += p.vy * step;
        p.life -= 0.016 * step;
        if (p.life <= 0) puffs.splice(i, 1);
      }

      dirty.forEach(paintPile);
      dirty.clear();
      paintAir();
    };

    check();
    let timer = 0;
    if (still) {
      paintAir();
      timer = window.setInterval(() => {
        check();
        paintAir();
      }, 500);
    } else frame = requestAnimationFrame(loop);
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      window.removeEventListener("resize", check);
    };
  }, []);

  return (
    <>
      <canvas ref={pilesRef} aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 h-full w-full" />
      <canvas ref={airRef} aria-hidden="true" className="pointer-events-none fixed inset-0 z-30 h-full w-full" />
    </>
  );
}
