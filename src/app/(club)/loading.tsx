/**
 * Shown the instant a club page is asked for, while the server prepares it: the page's shape in
 * soft grey, so a tap always answers at once (Next streams the real page in its place).
 */
export default function ClubLoading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6" aria-busy="true" aria-label="Chargement de la page">
      <div className="animate-pulse motion-reduce:animate-none">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-[14px] bg-surface" />
          <div className="h-7 w-48 rounded-full bg-surface" />
        </div>
        <div className="mt-4 h-4 w-72 max-w-full rounded-full bg-surface" />
        <div className="mt-8 grid gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-24 rounded-card border border-line-soft bg-surface/60" />
          ))}
        </div>
      </div>
      <p className="sr-only" role="status">
        Chargement…
      </p>
    </main>
  );
}
