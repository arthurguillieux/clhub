/** Read-only stars for an average rating — fractional averages round to the nearest half-star visually via a clipped overlay. */
export function StarRating({ value, size = "text-sm" }: { value: number; size?: string }) {
  return (
    <span className={`relative inline-block ${size} leading-none text-line`} aria-hidden="true">
      <span className="tracking-tight">★★★★★</span>
      <span
        className="absolute inset-0 overflow-hidden whitespace-nowrap text-primary"
        style={{ width: `${Math.max(0, Math.min(5, value)) * 20}%` }}
      >
        <span className="tracking-tight">★★★★★</span>
      </span>
    </span>
  );
}
