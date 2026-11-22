/** Subtitles of a terminal file: from the preparation (« 0:03 Réplique » per line) or a .vtt file. Pure. */
export type Cue = { start: number; end: number; text: string };

/** Subtitles from the preparation (« 0:03 Réplique » per line) or a .vtt file. */
export function parseCues(source: string): Cue[] {
  const text = source.trim();
  if (!text) return [];
  const seconds = (t: string) => t.split(":").reduce((acc, part) => acc * 60 + Number(part.replace(",", ".")), 0);
  if (text.startsWith("WEBVTT") || text.includes("-->")) {
    const cues: Cue[] = [];
    for (const block of text.split(/\r?\n\r?\n/)) {
      const lines = block.split(/\r?\n/);
      const i = lines.findIndex((l) => l.includes("-->"));
      if (i === -1) continue;
      const [a, b] = lines[i]!.split("-->").map((x) => x.trim().split(" ")[0]!);
      cues.push({ start: seconds(a!), end: seconds(b!), text: lines.slice(i + 1).join(" ") });
    }
    return cues;
  }
  const rows = text
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*(\d+:\d{1,2}(?:[.,]\d+)?)\s+(.+)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ start: seconds(m[1]!), text: m[2]! }));
  return rows.map((r, i) => ({ ...r, end: rows[i + 1]?.start ?? r.start + 6 }));
}

