export function Badge({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border border-line-soft bg-surface px-2.5 py-0.5 text-xs font-medium text-muted ${className}`}
    >
      {children}
    </span>
  );
}
