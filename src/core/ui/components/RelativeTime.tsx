import { formatExact, formatRelative } from "@/core/ui/relativeTime";

/** « il y a 5 min » on screen, the exact moment in the tooltip and for assistive tech. Rendered on the server. */
export function RelativeTime({ date, className }: { date: Date; className?: string }) {
  return (
    <time dateTime={date.toISOString()} title={formatExact(date)} className={className}>
      {formatRelative(date)}
    </time>
  );
}
