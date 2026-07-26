/**
 * The signature graphic object of the club (docs/01-produit.md §4). Gauge
 * and badges join once Lot 4 gives them real data — showing an empty or
 * fake gauge now would be worse than not showing one.
 */
export function MemberCard({
  name,
  memberNumber,
  image,
  bio,
  joinedAt,
}: {
  name: string;
  memberNumber: number | null;
  image?: string | null;
  bio?: string | null;
  joinedAt: Date;
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
    </div>
  );
}
