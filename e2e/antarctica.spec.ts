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
  await page.getByLabel("Mot de passe du scénario").fill("pas le bon");
  await page.getByRole("button", { name: "Ouvrir le scénario" }).click();
  await expect(page.getByText("Ce n'est pas le bon mot de passe.")).toBeVisible();
  await page.getByLabel("Mot de passe du scénario").fill("ape26");
  await page.getByRole("button", { name: "Ouvrir le scénario" }).click();
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

  await page.getByLabel("Patient zéro").selectOption({ label: "Joueur01 · ch. 1" });
  await tap("Noter le patient zéro");
  await expect(page.getByText("Patient zéro : Joueur01", { exact: true })).toBeVisible();
  await tap("🌙 La nuit tombe");
  await tap("Passer : personne");
  await page.getByLabel("Personne contaminée").selectOption({ label: "Joueur03 · ch. 3" });
  await tap("Contaminer");
  await page.getByLabel("Victime").selectOption({ label: "Joueur02 · ch. 2" });
  await tap("Noter la victime");
  await tap(/Les morts choisissent : Blizzard/);
  await tap("☀️ Le jour se lève");
  await expect(screen.getByText("JOUEUR02")).toBeVisible();

  await page.getByLabel("Exilé par le vote").selectOption({ label: "Joueur01 · ch. 1" });
  await tap("Exiler");
  await page.getByText("Terminer la boucle autrement").click();
  await tap("Victoire de la meute");
  await tap(/Reboot : boucle 2/);
  await tap("Arriver à la base");
  await tap(/Allumer le hall/);
  await expect(screen.getByText("JOUEUR02").last()).toBeVisible(); // the room sealed with the name
  await expect(screen.getByText("SCELLÉE").first()).toBeVisible();

  await tap("Le village vote contre le meneur");
  await tap("Déclencher la bonne fin");
  await expect(screen.getByText("SIMULATION INTERROMPUE")).toBeVisible();
  await tap("Terminer la soirée");
  await expect(page.getByText("SOIRÉE TERMINÉE")).toBeVisible();
  await ctx.close();
});
