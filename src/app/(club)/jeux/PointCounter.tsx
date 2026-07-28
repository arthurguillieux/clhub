"use client";

import { useEffect, useState } from "react";
import { Card } from "@/core/ui/components/Card";
import { Button } from "@/core/ui/components/Button";
import { Input } from "@/core/ui/components/Field";
import { PLAYER_COLORS, playerColorByKey } from "@/core/ui/playerColors";

interface Player {
  id: string;
  name: string;
  colorKey: string;
  score: number;
}

const STORAGE_KEY = "clhub:jeux:points";

function nextColorKey(players: Player[]): string {
  return PLAYER_COLORS[players.length % PLAYER_COLORS.length]!.key;
}

export function PointCounter() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Reading localStorage only after mount (never during the lazy useState
    // initializer) is deliberate: the initializer runs during SSR too, where
    // there's no localStorage, so seeding state from it there would render
    // different markup server- vs client-side and trigger a hydration
    // mismatch. This is exactly the "synchronize with an external system"
    // case effects are for.
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
      if (raw) setPlayers(JSON.parse(raw) as Player[]);
    } catch {
      // Corrupt or blocked storage — just start from an empty scoreboard.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
  }, [players, hydrated]);

  function addPlayer() {
    setPlayers((prev) => [
      ...prev,
      { id: crypto.randomUUID(), name: `Joueur ${prev.length + 1}`, colorKey: nextColorKey(prev), score: 0 },
    ]);
  }

  function removePlayer(id: string) {
    setPlayers((prev) => prev.filter((p) => p.id !== id));
  }

  function renamePlayer(id: string, name: string) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  }

  function setColor(id: string, colorKey: string) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, colorKey } : p)));
  }

  function addPoint(id: string, delta: number) {
    setPlayers((prev) => prev.map((p) => (p.id === id ? { ...p, score: p.score + delta } : p)));
  }

  function resetScores() {
    setPlayers((prev) => prev.map((p) => ({ ...p, score: 0 })));
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {players.length === 0 ? "Ajoute des joueurs pour commencer." : `${players.length} joueur${players.length > 1 ? "s" : ""}`}
        </p>
        <div className="flex items-center gap-2">
          {players.length > 0 && (
            <Button type="button" variant="ghost" onClick={resetScores}>
              Remettre les scores à zéro
            </Button>
          )}
          <Button type="button" variant="accent" onClick={addPlayer}>
            + Joueur
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {players.map((player) => {
          const color = playerColorByKey(player.colorKey);
          return (
            <Card key={player.id} className="flex flex-col gap-3 p-4">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className={`h-3 w-3 shrink-0 rounded-full ${color.bg}`} />
                <Input
                  aria-label="Nom du joueur"
                  value={player.name}
                  onChange={(e) => renamePlayer(player.id, e.target.value)}
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => removePlayer(player.id)}
                  aria-label={`Retirer ${player.name}`}
                  className="text-sm text-muted hover:text-ink"
                >
                  ✕
                </button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {PLAYER_COLORS.map((c) => (
                  <button
                    key={c.key}
                    type="button"
                    aria-label={`Couleur ${c.label}`}
                    aria-pressed={c.key === player.colorKey}
                    onClick={() => setColor(player.id, c.key)}
                    className={`h-5 w-5 rounded-full ${c.bg} ${c.key === player.colorKey ? "ring-2 ring-ink ring-offset-2 ring-offset-surface-raised" : "opacity-50 hover:opacity-100"}`}
                  />
                ))}
              </div>

              <div className="flex items-center justify-center gap-5">
                <button
                  type="button"
                  onClick={() => addPoint(player.id, -1)}
                  aria-label="Retirer un point"
                  className="glow-box-primary flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-xl font-bold text-ink hover:bg-surface-raised"
                >
                  −
                </button>
                <span className="min-w-16 text-center font-display text-3xl font-extrabold tabular-nums text-ink">
                  {player.score}
                </span>
                <button
                  type="button"
                  onClick={() => addPoint(player.id, 1)}
                  aria-label="Ajouter un point"
                  className="glow-box-primary flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-xl font-bold text-ink hover:bg-surface-raised"
                >
                  +
                </button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
