import { test, expect } from "@playwright/test";

/**
 * Loups-garous › Scénarios spéciaux › Antarctica, the path of the prompt (§18): unlock with the password,
 * prepare 20 players, launch, light the hall, open Δ and Β, try Α (refused on the projection), open a
 * terminal and a file, repair the circuit, a night, a day, the end of the loop, the reboot (sealed rooms
 * on the projection), the good ending. Rules are tested in modules/loups/scenarios.
 */
const NAMES = Array.from({ length: 20 }, (_, i) => `Joueur${String(i + 1).padStart(2, "0")}`);

test("antarctica: preparation, base, terminal, circuit, a night, reboot, good ending", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  await page.goto("/jeux/loups/scenarios");
  // Opened once, it stays open for this member (a run before may already have done it).
  if (await page.getByLabel("Mot de passe du scénario").count()) {
    await page.getByLabel("Mot de passe du scénario").fill("pas le bon");
    await page.getByRole("button", { name: "Ouvrir le scénario" }).click();
    await expect(page.getByText("Ce n'est pas le bon mot de passe.")).toBeVisible();
    await page.getByLabel("Mot de passe du scénario").fill("ape26");
    await page.getByRole("button", { name: "Ouvrir le scénario" }).click();
  }
  await page.getByRole("button", { name: "❄️ Préparer une soirée" }).click();
  await expect(page).toHaveURL(/\/scenario\/[A-Z0-9]{6}\/console$/);

  await page.getByLabel("Prénoms des joueurs, un par ligne").fill(NAMES.join("\n"));
  await page.getByRole("button", { name: "Enregistrer les 20 joueurs" }).click();
  await expect(page.getByText("JOUEURS ET CHAMBRES")).toBeVisible();
  const link = await page.getByLabel("Lien de la projection").inputValue();

  const ctx = await browser.newContext({ baseURL, viewport: { width: 1600, height: 900 }, storageState: { cookies: [], origins: [] } });
  const screen = await ctx.newPage();
  await screen.goto(link);
  await screen.getByRole("button", { name: /Lancer la projection/ }).click();
  await expect(page.getByText("Projection connectée")).toBeVisible({ timeout: 15_000 });

  const tap = async (name: string | RegExp) => {
    await page.getByRole("button", { name }).first().click();
  };
  const open = async (title: string) => page.locator("summary", { hasText: new RegExp(`^${title}`) }).click();
  await tap("❄️ Lancer la soirée");
  await tap("Commencer : prologue du bus");
  await tap("Arriver à la base");
  await expect(screen.getByText("— SECTEUR NON ÉCLAIRÉ —")).toBeVisible();

  await open("BASE");
  await tap(/Allumer le hall/);
  await expect(page.getByText("HALL ÉCLAIRÉ")).toBeVisible();
  await tap("Ouvrir");
  await expect(page.getByText("1 / 3 OUVERTES")).toBeVisible();
  await tap("Ouvrir");
  await expect(page.getByText("2 / 3 OUVERTES")).toBeVisible();
  await tap("Tenter");
  await expect(screen.getByText("ACCÈS REFUSÉ")).toBeVisible();

  await open("TERMINAUX");
  await tap(/Ordi de l'accueil/);
  await expect(screen.getByText(/LOG_871220\.VID/)).toBeVisible({ timeout: 10_000 });
  await tap(/LOG_871220/);
  await expect(screen.getByText("BANDE ENDOMMAGÉE")).toBeVisible(); // no media on this computer: said, not broken
  await tap("Retour au plan");

  await open("CIRCUIT");
  await tap("Afficher le boîtier");
  for (const k of ["A ▼", "C ▼", "D ▼"]) {
    await tap(k);
    await expect(page.getByRole("button", { name: k.replace("▼", "▲") })).toBeVisible();
  }
  await tap("Mettre sous tension");
  await expect(screen.getByText("PANIC ROOM OPÉRATIONNELLE").first()).toBeVisible();
  await tap("Ranger le boîtier");

  // V1.1: the items handed out — the tapes and the life syringe.
  await open("JOUEURS");
  for (const [item, who] of [
    ["Bandes de surveillance", "Joueur05 · ch. 5"],
    ["Seringue de vie", "Joueur06 · ch. 6"],
  ] as const) {
    await page.getByLabel("Objet", { exact: true }).selectOption({ label: item });
    await page.getByLabel("Joueur qui reçoit l'objet").selectOption({ label: who });
    await tap("Confier");
    await expect(page.getByText(item).first()).toBeVisible();
  }

  await page.getByLabel("Patient zéro").selectOption({ label: "Joueur01 · ch. 1" });
  await tap("Noter le patient zéro");
  await expect(page.getByText("Patient zéro : Joueur01", { exact: true })).toBeVisible();
  await tap("🌙 La nuit tombe");
  await tap("Passer : personne");
  await page.getByLabel("Joueur regardé sur les bandes").selectOption({ label: "Joueur01 · ch. 1" });
  await tap("Voir son camp");
  await expect(page.getByText("JOUEUR01 : CONTAMINÉ")).toBeVisible();
  await page.getByLabel("Personne contaminée").selectOption({ label: "Joueur03 · ch. 3" });
  await tap("Contaminer");
  await page.getByLabel("Victime").selectOption({ label: "Joueur04 · ch. 4" });
  await tap("Noter la victime");
  await expect(page.getByText("Victime de la nuit : Joueur04")).toBeVisible();
  await tap(/sauver Joueur04/);
  await tap(/Les morts choisissent : Blizzard/);
  await tap("☀️ Le jour se lève");
  await expect(screen.getByText("CETTE NUIT, AUCUN SIGNAL PERDU")).toBeVisible();
  await open("JOURNAL");
  await expect(page.getByText(/Contamination : Joueur03\. Victime : Joueur04 \(sauvée\)/)).toBeVisible();

  await page.getByLabel("Exilé par le vote").selectOption({ label: "Joueur01 · ch. 1" });
  await tap("Exiler");
  await page.getByText("Terminer la boucle autrement").click();
  await tap("Victoire de la meute");
  await tap(/Reboot : boucle 2/);
  await tap("Arriver à la base");
  await tap(/Allumer le hall/);
  await expect(screen.getByText("JOUEUR01").last()).toBeVisible(); // the exiled one's room, sealed with the name
  await expect(screen.getByText("SCELLÉE").first()).toBeVisible();

  // SUJETS.DAT, built from the players: last loop's exile is written down, no side ever.
  await open("FAILLES");
  await tap(/Les dossiers sujets/);
  await expect(screen.getByText(/REGISTRE DES SUJETS — SESSION 02/)).toBeVisible({ timeout: 10_000 });
  await expect(screen.getByText(/SESSION 01 : EXCLU/)).toBeVisible({ timeout: 15_000 });

  await tap("Le village vote contre le meneur");
  await tap("Déclencher la bonne fin");
  await expect(screen.getByText("SIMULATION INTERROMPUE")).toBeVisible();
  await tap("Terminer la soirée");
  await expect(page.getByText("SOIRÉE TERMINÉE")).toBeVisible();
  await ctx.close();
});

test("antarctica: « Simuler une partie » opens at loop 2 with loop 1's dead sealed, and goes away in one click", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/jeux/loups/scenarios");
  if (await page.getByLabel("Mot de passe du scénario").count()) {
    await page.getByLabel("Mot de passe du scénario").fill("APE26");
    await page.getByRole("button", { name: "Ouvrir le scénario" }).click();
  }
  await page.locator('select[name="start"]').selectOption("b2-arrival");
  await page.getByRole("button", { name: "🧪 Simuler une partie" }).click();
  await expect(page).toHaveURL(/\/scenario\/[A-Z0-9]{6}\/console$/);
  await expect(page.getByText("SIMULATION", { exact: true })).toBeVisible();
  await expect(page.getByText("Boucle 2 · Arrivée").first()).toBeVisible();
  await page.locator("summary", { hasText: /^JOURNAL/ }).click();
  await expect(page.getByText(/Reboot de la simulation/)).toBeVisible();
  await page.goto("/jeux/loups/scenarios");
  await expect(page.getByRole("heading", { name: "Simulations" })).toBeVisible();
  await page.getByRole("button", { name: "Supprimer toutes les simulations" }).click();
  await page.getByRole("button", { name: "Supprimer les simulations" }).click();
  await expect(page.getByRole("heading", { name: "Simulations" })).toHaveCount(0);
});
