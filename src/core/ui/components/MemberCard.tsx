import type { GaugePosition } from "@/core/achievements/gauge";
import type { MemberBadge } from "@/core/achievements/engine";

/** The signature graphic object of the club (docs/01-produit.md §4). */
export function MemberCard({
  name,
  memberNumber,
  image,
  bio,
  joinedAt,
  gauge,
  badges,
}: {
  name: string;
  memberNumber: number | null;
  image?: string | null;
  bio?: string | null;
  joinedAt: Date;
  /** Omitted while no lending activity exists yet — an empty gauge is worse than none. */
  gauge?: GaugePosition;
  badges?: MemberBadge[];
}) {
  return (
    <div
      className="relative overflow-hidden rounded-card p-6 text-primary-ink shadow-lg"
      style={{
        background:
          "linear-gradient(155deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 82%, black) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-10"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs tracking-wider opacity-75">
            MEMBRE Nº {memberNumber !== null ? String(memberNumber).padStart(3, "0") : "???"}
          </p>
          <p className="mt-0.5 text-xs opacity-60">
            Depuis {joinedAt.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
        </div>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- small avatar, no next/image needed
          <img
            src={image}
            alt=""
            className="h-12 w-12 rounded-full border-2 border-white/30 object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/30 bg-accent font-display text-lg font-extrabold text-accent-ink">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <h2 className="relative mt-4 font-display text-2xl font-extrabold">{name}</h2>
      {bio && <p className="relative mt-1 text-sm opacity-80">{bio}</p>}

      {gauge && (
        <div className="relative mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white/80"
              style={{
                marginLeft: `${((gauge.ratio + 1) / 2) * 100}%`,
                width: "3px",
                transform: "translateX(-1.5px)",
              }}
            />
          </div>
          <p className="mt-1.5 text-xs opacity-80">
            {gauge.emoji} {gauge.label}
          </p>
        </div>
      )}

      {badges && badges.length > 0 && (
        <div className="relative mt-4 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.key}
              title={`${b.name} — ${b.description}`}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-white/10 text-base"
            >
              {b.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
