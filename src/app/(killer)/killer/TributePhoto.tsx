/** A tribute's selfie, or their initial on coal while they haven't taken one yet. Sized by `className`. */
export function TributePhoto({
  code,
  id,
  name,
  photoVersion,
  fallen = false,
  className = "",
}: {
  code: string;
  id: string;
  name: string;
  photoVersion: number | null;
  fallen?: boolean;
  className?: string;
}) {
  const shape = `killer-portrait aspect-square overflow-hidden rounded-full ${fallen ? "fallen" : ""} ${className}`;
  if (photoVersion === null) {
    return (
      <div
        className={`${shape} flex items-center justify-center bg-[var(--k-surface-strong)] font-semibold text-[var(--k-accent)]`}
        style={{ containerType: "inline-size" }}
      >
        <span style={{ fontSize: "40cqw" }}>{name.charAt(0).toUpperCase()}</span>
      </div>
    );
  }
  return (
    <div className={shape} style={{ containerType: "inline-size" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- small selfie served from the database */}
      <img src={`/api/killer/${code}/photo/${id}?v=${photoVersion}`} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}
