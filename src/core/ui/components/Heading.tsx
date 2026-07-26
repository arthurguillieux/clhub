export function PageTitle({ children }: { children: React.ReactNode }) {
  return (
    <h1 className="font-display text-3xl font-extrabold tracking-tight text-ink text-balance">
      {children}
    </h1>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-extrabold text-ink">{children}</h2>;
}
