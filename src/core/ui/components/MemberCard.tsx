import type { GaugePosition } from "@/core/achievements/gauge";
import type { MemberBadge } from "@/core/achievements/engine";

/**
 * The signature graphic object of the club (docs/01-produit.md §4). Dark
 * card with a glowing neon edge rather than a solid neon fill — `--primary`
 * at full saturation across the whole surface would be a wall of green,
 * not a "card". The glow does the work instead.
 */
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
      className="glow-box-primary relative overflow-hidden rounded-card border border-primary/40 p-4 text-ink"
      style={{
        background: "linear-gradient(155deg, var(--surface-raised) 0%, var(--ground) 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 text-primary opacity-[0.08]"
        style={{
          backgroundImage: "radial-gradient(circle, currentColor 1px, transparent 1px)",
          backgroundSize: "14px 14px",
        }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="glow-text-primary font-mono text-xs tracking-wider text-primary">
            MEMBRE Nº {memberNumber !== null ? String(memberNumber).padStart(3, "0") : "???"}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Depuis {joinedAt.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}
          </p>
        </div>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- small avatar, no next/image needed
          <img
            src={image}
            alt=""
            className="h-9 w-9 rounded-full border-2 border-primary/50 object-cover"
          />
        ) : (
          <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-primary/50 bg-accent font-display text-sm font-extrabold text-accent-ink">
            {name.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <h2 className="relative mt-3 font-display text-lg font-extrabold text-ink">{name}</h2>
      {bio && <p className="relative mt-1 text-sm text-muted">{bio}</p>}

      {gauge && (
        <div className="relative mt-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-line-soft">
            <div
              className="glow-box-primary h-full rounded-full bg-primary"
              style={{
                marginLeft: `${((gauge.ratio + 1) / 2) * 100}%`,
                width: "3px",
                transform: "translateX(-1.5px)",
              }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {gauge.emoji} {gauge.label}
          </p>
        </div>
      )}

      {badges && badges.length > 0 && (
        <div className="relative mt-3 flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.key}
              title={`${b.name} — ${b.description}`}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-primary/30 bg-surface text-sm"
            >
              {b.icon}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
