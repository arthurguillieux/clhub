import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getArchiveView } from "@/modules/killer/data/games";
import { checkKillerHost } from "@/modules/killer/host";
import { TributePhoto } from "../../TributePhoto";
import { ArchiveActions } from "./ArchiveActions";

export const metadata: Metadata = { title: "Killer — archive", robots: { index: false, follow: false } };

const clock = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });
const day = new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", weekday: "long", day: "numeric", month: "long", year: "numeric" });

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

/** A finished game, filed away: everything worth remembering, for its organizers to look back on. */
export default async function KillerArchivePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const check = await checkKillerHost(code);
  if (!check.ok) redirect(check.reason === "signed-out" ? "/sign-in" : `/killer/${code}/panneau`);
  if (!check.game.archivedAt) redirect(`/killer/${check.game.code}/panneau`);

  const a = await getArchiveView(check.game);
  const s = a.stats;
  const photoOf = new Map(a.agents.map((ag) => [ag.id, ag.photoVersion]));
  const tiles = [
    { label: "Durée", value: s?.durationMinutes != null ? formatDuration(s.durationMinutes) : "—" },
    { label: "Éliminations", value: String(a.kills.length) },
    { label: "Première élimination", value: s?.fastestKill ? `${s.fastestKill.killerName} sur ${s.fastestKill.victimName}` : "—" },
    { label: "Dernier·e éliminé·e", value: s?.lastFallen?.name ?? "—" },
  ];

  return (
    <main className="killer min-h-dvh px-4 pt-5 pb-16">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <header>
          <Link href="/jeux/killer" className="text-sm text-[var(--k-muted)] hover:text-[var(--k-ink)]">
            ← Mes parties
          </Link>
          <p className="killer-label mt-3">Partie archivée · code {a.code}</p>
          <h1 className="killer-title mt-1 text-2xl">{a.title}</h1>
          {a.startedAt && (
            <p className="mt-1 text-sm text-[var(--k-muted)]">
              Jouée le {day.format(new Date(a.startedAt))}, de {clock.format(new Date(a.startedAt))}
              {a.endedAt && ` à ${clock.format(new Date(a.endedAt))}`}
            </p>
          )}
        </header>

        <section className="killer-panel killer-frame flex flex-col items-center p-5 text-center">
          <p className="killer-label">{s?.winner ? "Dernier agent actif" : "Fin de la simulation"}</p>
          {s?.winner ? (
            <>
              <TributePhoto code={a.code} id={s.winner.id} name={s.winner.name} photoVersion={photoOf.get(s.winner.id) ?? null} className="mt-4 w-32" />
              <p className="killer-title mt-3 text-3xl">🏆 {s.winner.name}</p>
            </>
          ) : (
            <p className="mt-2 text-lg font-semibold">Partie arrêtée avant la fin</p>
          )}
        </section>

        <section className="grid grid-cols-2 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="killer-panel p-3">
              <p className="killer-label">{t.label}</p>
              <p className="mt-1 font-semibold">{t.value}</p>
            </div>
          ))}
        </section>

        {s && s.podium.length > 0 && (
          <section className="killer-panel p-4">
            <p className="killer-label">Le tableau de chasse</p>
            <ol className="mt-3 flex flex-col gap-2.5">
              {s.podium.map((p, i) => (
                <li key={p.id} className="flex items-center gap-3">
                  <span className="killer-title w-6 text-center text-xl text-[var(--k-accent)]">{i + 1}</span>
                  <TributePhoto code={a.code} id={p.id} name={p.name} photoVersion={photoOf.get(p.id) ?? null} className="w-10 shrink-0" />
                  <span className="flex-1 truncate font-semibold">{p.name}</span>
                  <span className="text-sm font-semibold text-[var(--k-accent)] tabular-nums">
                    {p.kills} élimination{p.kills > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {a.kills.length > 0 && (
          <section className="killer-panel p-4">
            <p className="killer-label">Toutes les éliminations</p>
            <ol className="mt-3 flex flex-col gap-3">
              {a.kills.map((k, i) => (
                <li key={i} className="flex gap-3">
                  <span className="w-12 shrink-0 text-sm text-[var(--k-muted)] tabular-nums">{clock.format(new Date(k.at))}</span>
                  <div>
                    <p>
                      <b>{k.killer}</b> a éliminé <b>{k.victim}</b>
                    </p>
                    {k.mission && <p className="mt-0.5 text-sm text-[var(--k-muted)] italic">Mission : {k.mission}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section>
          <p className="killer-label">Les agents ({a.agents.length})</p>
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {a.agents.map((ag) => (
              <li key={ag.id} className="killer-panel flex flex-col items-center p-3 text-center">
                <TributePhoto code={a.code} id={ag.id} name={ag.name} photoVersion={ag.photoVersion} fallen={!ag.alive} className="w-20" />
                <p className="mt-2 font-semibold">{ag.name}</p>
                <p className="text-xs text-[var(--k-muted)]">
                  {ag.alive
                    ? s?.winner?.id === ag.id
                      ? "Vainqueur"
                      : "Encore en jeu à la fin"
                    : `Éliminé·e${ag.killedAt ? ` à ${clock.format(new Date(ag.killedAt))}` : ""}${ag.killedBy ? ` par ${ag.killedBy}` : ""}`}
                </p>
                {ag.kills > 0 && (
                  <p className="text-xs font-semibold text-[var(--k-accent)]">
                    {ag.kills} élimination{ag.kills > 1 ? "s" : ""}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <ArchiveActions code={a.code} isCreator={check.role === "host"} hasPhotos={a.agents.some((ag) => ag.photoVersion !== null)} />
      </div>
    </main>
  );
}
