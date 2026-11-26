import type { SpaceId } from "@/modules/loups/scenarios/station";

/**
 * What stands inside each space of the station (the detail that makes it a base, not a diagram), as on
 * the sandbox mockup. Shapes only: the colours come from around them (the room's CSS on the
 * projection, the phone's own strokes), so the same drawing serves both screens. The dormitory's beds
 * are drawn with its rooms, by whoever draws them.
 */
export function Furniture({ id }: { id: SpaceId }) {
  const r = (x: number, y: number, w: number, h: number, key?: string) => <rect key={key} className="f" x={x} y={y} width={w} height={h} rx={2} />;
  switch (id) {
    case "hall":
      return (
        <g>
          {/* The reception desk, in an L, its computer and keyboard. */}
          {r(365, 470, 150, 22)}
          {r(365, 470, 22, 80)}
          <rect className="f" x={420} y={474} width={26} height={14} />
          <rect className="f" x={452} y={478} width={28} height={7} />
          {/* The rest corner: sofa and low table; two plants; the rug. */}
          {r(565, 585, 74, 26)}
          <circle className="f" cx={600} cy={560} r={13} />
          <circle className="f" cx={645} cy={440} r={9} />
          <circle className="f" cx={355} cy={625} r={9} />
          <rect x={440} y={560} width={110} height={60} fill="none" strokeDasharray="3 4" />
          {/* The electrical box on the wall. */}
          {r(616, 432, 24, 30)}
        </g>
      );
    case "sas":
      return (
        <g>
          {r(450, 650, 14, 66)}
          {r(536, 650, 14, 66)}
          {[0, 1, 2].map((i) => (
            <line key={i} x1={480 + i * 20} y1={652} x2={480 + i * 20} y2={668} />
          ))}
        </g>
      );
    case "couloir":
      return (
        <g>
          {Array.from({ length: 5 }, (_, i) => (
            <rect key={i} className="f" x={494} y={180 + i * 50} width={12} height={5} />
          ))}
        </g>
      );
    case "archives":
      return (
        <g>
          {[0, 1].map((i) => (
            <g key={i}>
              {r(244 + i * 34, 202, 26, 66)}
              <line x1={244 + i * 34} y1={224} x2={270 + i * 34} y2={224} />
              <line x1={244 + i * 34} y1={246} x2={270 + i * 34} y2={246} />
            </g>
          ))}
          {/* The desk and its terminal. */}
          {r(318, 238, 42, 26)}
          <rect className="f" x={328} y={243} width={20} height={12} />
        </g>
      );
    case "infirmerie":
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              {r(342, 318 + i * 26, 46, 17)}
              <rect className="f" x={342} y={318 + i * 26} width={12} height={17} />
            </g>
          ))}
          {r(408, 322, 26, 62)}
        </g>
      );
    case "generateurs":
      return (
        <g>
          {[610, 700].map((x) => (
            <g key={x}>
              <circle className="f" cx={x} cy={225} r={28} />
              <path d={`M${x - 14} 225h28M${x} 211v28`} />
            </g>
          ))}
        </g>
      );
    case "securite":
      return (
        <g>
          {r(562, 310, 84, 20)}
          {[0, 1, 2].map((i) => (
            <rect key={i} className="f" x={567 + i * 26} y={314} width={20} height={12} />
          ))}
          {r(568, 352, 30, 30)}
          <line x1={583} y1={352} x2={583} y2={338} />
        </g>
      );
    case "labo":
      return (
        <g>
          {r(400, 66, 120, 18)}
          {r(400, 98, 120, 18)}
          <rect className="f" x={440} y={72} width={22} height={13} />
          <rect x={545} y={56} width={60} height={70} fill="none" strokeDasharray="4 3" />
        </g>
      );
    default:
      return null;
  }
}
