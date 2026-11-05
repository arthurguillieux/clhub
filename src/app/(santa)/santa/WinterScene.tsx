/**
 * Much wider than any screen, on purpose: the picture covers its box, so if it were narrower, a wide
 * window would blow it up by its width and push the tops of the firs out of the box. This way their
 * size follows the window's height.
 */
const WIDTH = 3200;

/** A fixed sequence of numbers, so the forest is the same on every visit and on the server. */
function seeded(seed: number) {
  let state = seed;
  return () => (state = (state * 16807) % 2147483647) / 2147483647;
}

const point = (x: number, y: number) => `${Math.round(x)} ${Math.round(y)}`;

/** A fir as tiers of branches, each wider than the last. Returns its shape and, if asked, the snow lying on each tier. */
function fir(x: number, ground: number, height: number, random: () => number, snowy: boolean) {
  const tiers = height > 170 ? 6 : height > 90 ? 5 : 4;
  const top = ground - height;
  const body = height * 0.9;
  const spread = height * 0.25;
  const right: string[] = [];
  const left: string[] = [];
  let snow = "";
  let tierTop = top;
  for (let t = 1; t <= tiers; t++) {
    const y = top + body * (t / tiers) ** 1.08;
    const reach = spread * (t / tiers) ** 0.9;
    const r = reach * (0.92 + random() * 0.16);
    const l = reach * (0.92 + random() * 0.16);
    const droop = height * 0.018;
    right.push(point(x + r, y + droop), point(x + r * 0.58, y - droop));
    left.unshift(point(x - l * 0.58, y - droop), point(x - l, y + droop));
    if (snowy) {
      // White on the upper part of the tier, its lower edge ragged like snow caught in branches.
      const drop = (y - tierTop) * 0.74;
      const edge = [0.86, 0.58, 0.3, 0, -0.3, -0.58, -0.86].map((u, i) => point(x + u * (u > 0 ? r : l), tierTop + drop * (1 - 0.16 * Math.abs(u)) + (i % 2 ? -drop * 0.2 : drop * 0.1)));
      snow += `M${point(x, tierTop - height * 0.012)} L${edge.join(" L")} Z `;
    }
    tierTop = y - droop * 3;
  }
  const trunk = height * 0.03;
  const shape = `M${point(x, top)} L${right.join(" L")} L${point(x + trunk, top + body)} L${point(x + trunk, ground)} L${point(x - trunk, ground)} L${point(x - trunk, top + body)} L${left.join(" L")} Z `;
  return { shape, snow };
}

function forest(seed: number, count: number, ground: (x: number) => number, sizes: [number, number], snowy = false) {
  const random = seeded(seed);
  let shapes = "";
  let snow = "";
  for (let i = 0; i < count; i++) {
    const x = ((i + 0.15 + random() * 0.7) / count) * (WIDTH + 200) - 100;
    const tree = fir(x, ground(x) + 6, sizes[0] + random() * (sizes[1] - sizes[0]), random, snowy);
    shapes += tree.shape;
    snow += tree.snow;
  }
  return { shapes, snow };
}

const farGround = (x: number) => 372 + Math.sin(x * 0.004) * 14;
const midGround = (x: number) => 412 + Math.sin(x * 0.0031 + 2) * 16;
const nearGround = (x: number) => 462 + Math.sin(x * 0.0024 + 4) * 16;

const FAR = forest(11, 104, farGround, [46, 96]);
const MID = forest(23, 54, midGround, [96, 170]);
const NEAR = forest(47, 27, nearGround, [170, 290], true);

function hill(ground: (x: number) => number) {
  const points = Array.from({ length: WIDTH / 50 + 3 }, (_, i) => point(i * 50 - 50, ground(i * 50 - 50)));
  return `M-50 620 L${points.join(" L")} L${WIDTH + 50} 620 Z`;
}

/**
 * The white Christmas morning behind the page: a pale sky lit from the horizon, three rows of firs
 * fading into the distance, and a warm window down in the woods: one near the middle for phones, one
 * further out for wide screens, where panels hide the middle. Nothing moves here, the life comes from
 * the snow in front of it.
 */
export function WinterScene() {
  return (
    <div aria-hidden="true" className="santa-sky pointer-events-none fixed inset-0">
      <svg viewBox={`0 0 ${WIDTH} 600`} preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[42vh] min-h-72 w-full overflow-visible">
        <defs>
          <radialGradient id="santa-window-glow">
            <stop offset="0" stopColor="#ffc56e" stopOpacity="0.75" />
            <stop offset="1" stopColor="#ffc56e" stopOpacity="0" />
          </radialGradient>
          <g id="santa-cabin">
            <circle cx="30" cy="22" r="96" fill="url(#santa-window-glow)" />
            <rect x="-6" y="4" width="72" height="42" fill="#59463e" />
            <path d="M-14 8 L30 -28 L74 8 Z" fill="#46352f" />
            <path d="M-18 10 Q-12 -2 2 -8 L30 -32 L58 -8 Q72 -2 78 10 Q60 4 46 7 Q30 -2 14 8 Q2 4 -18 10 Z" fill="#fff" />
            <rect x="12" y="16" width="15" height="16" rx="1.5" fill="#ffc56e" />
            <rect x="35" y="16" width="15" height="16" rx="1.5" fill="#ffc56e" />
            <path d="M19.5 16 V32 M12 24 H27 M42.5 16 V32 M35 24 H50" stroke="#59463e" strokeWidth="1.4" />
          </g>
        </defs>
        <path d={FAR.shapes} fill="#a9c0ce" />
        <path d={hill(farGround)} fill="#d3e1e9" />
        <path d={MID.shapes} fill="#7b9dad" />
        <path d={hill(midGround)} fill="#e6eef3" />

        <use href="#santa-cabin" x="1621" y="416" />
        <use href="#santa-cabin" x="2514" y="400" />

        <path d={NEAR.shapes} fill="#35605f" />
        <path d={NEAR.snow} fill="#f7fafc" />
        <path d={hill(nearGround)} fill="#f8fbfd" />
      </svg>
    </div>
  );
}
