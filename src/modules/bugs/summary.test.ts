import { describe, expect, it } from "vitest";
import { forClaude } from "./summary";

describe("Copier pour Claude", () => {
  const at = new Date(Date.UTC(2026, 10, 22, 17, 5));
  const report = { page: "/jeux/loups", message: "Lancer la partie ne fait rien.\nMessage : pas de connexion.", userAgent: "Safari iPhone", status: "new", note: null, createdAt: at, name: "Vak" };

  it("keeps the open reports and the server's errors, quoted, and leaves the settled ones out", () => {
    const text = forClaude([report, { ...report, status: "fixed", message: "Déjà réglé" }, { ...report, status: "bug", note: "Je l'ai aussi" }], [{ path: "/loups/ABC/meneur", method: "POST", routeType: "action", message: "boom", occurredAt: at }]);
    expect(text).toContain("## Nouveau · 22/11/2026 18:05 · Vak");
    expect(text).toContain("> Lancer la partie ne fait rien.\n> Message : pas de connexion.");
    expect(text).toContain("- Note d'Arthur : Je l'ai aussi");
    expect(text).not.toContain("Déjà réglé");
    expect(text).toContain("POST /loups/ABC/meneur (action) : boom");
  });

  it("says when nothing is open", () => {
    expect(forClaude([], [])).toContain("Aucun signalement ouvert.");
  });
});
