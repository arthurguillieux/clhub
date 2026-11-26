import { test, expect } from "@playwright/test";

/**
 * Loups-garous › Scénarios spéciaux › Antarctica, the path of V1.2 §11: unlock with the password, prepare
 * 20 players, the texts to read, the chief elected by moving, the door of the day, a missed shot, the
 * healthy chief exiled (lockdown), the dead's moment, the reboot, the lab forced by Marga, the good
 * ending. Rules are tested in modules/loups/scenarios.
 */
const NAMES = Array.from({ length: 20 }, (_, i) => `Joueur${String(i + 1).padStart(2, "0")}`);

test("antarctica V1.2: election, a door, a missed shot, the healthy chief exiled, the dead's moment, reboot, Marga forces the lab, good ending", async ({ page, browser, baseURL }) => {
  test.setTimeout(150_000);
  await page.goto("/jeux/loups/scenarios");
  // Opened once, it stays open for this member (a run before may already have done it).
  if (await page.getByLabel("Mot de passe du scénario").count()) {
    await page.getByLabel("Mot de passe du scénario").fill("pas le bon");
    await page.getByRole("button", { name: "Ouvrir le scénario" }).click();
    await expect(page.getByText("Ce n'est pas le bon mot de passe.")).toBeVisible();
    await page.getByLabel("Mot de passe du scénario").fill("ape26");
    await page.getByRole("button", { name: "Ouvrir le scénario" }).click();
  }
  await page.getByRole("button", { name: "❄️ Ouvrir la station Antarctica" }).click();
  await expect(page).toHaveURL(/\/scenario\/[A-Z0-9]{6}\/console$/);

  // The station first, on its own: its projection, its plan, its doors, its light.
  await expect(page.getByRole("heading", { name: "STATION ANTARCTICA" })).toBeVisible();
  await expect(page.getByText("Aucun protocole chargé")).toBeVisible();
  const bar = page.getByRole("navigation", { name: "Commandes" });
  await bar.getByRole("button", { name: /Écran/ }).click();
  const link = await page.getByLabel("Lien de la projection").inputValue();
  // Back on the scenarios page (from the projection computer, say): the same station, never a second one.
  const consoleUrl = page.url();
  await page.goto("/jeux/loups/scenarios");
  await expect(page.getByRole("button", { name: "❄️ Ouvrir la station Antarctica" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "📽️ Ouvrir sa projection" })).toHaveAttribute("href", new URL(link).pathname);
  await page.getByRole("link", { name: "📱 Piloter la station" }).click();
  await expect(page).toHaveURL(consoleUrl);
  await bar.getByRole("button", { name: /Écran/ }).click();
  const ctx = await browser.newContext({ baseURL, viewport: { width: 1600, height: 900 }, storageState: { cookies: [], origins: [] } });
  const screen = await ctx.newPage();
  await screen.goto(link);
  await screen.getByRole("button", { name: /Lancer la projection/ }).click();
  await expect(page.getByText(/Projection connectée/).first()).toBeVisible({ timeout: 15_000 });
  await expect(screen.getByText("STATION ANTARCTICA")).toBeVisible();
  await page.getByRole("button", { name: /^Plan/ }).click();
  await expect(screen.getByText("— SECTEUR NON ÉCLAIRÉ —")).toBeVisible();
  await page.getByRole("button", { name: "Fermer la fiche" }).click();
  await page.getByRole("button", { name: /^HALL, dans le noir/ }).click();
  await page.getByRole("button", { name: /Allumer le hall/ }).click();
  await expect(page.getByRole("button", { name: /Éteindre le hall/ })).toBeVisible();
  await page.getByRole("button", { name: "Fermer la fiche" }).click();
  await page.getByRole("button", { name: /^Porte Α/ }).click();
  await expect(screen.getByText("ACCÈS REFUSÉ")).toBeVisible();
  await page.getByRole("button", { name: /^Porte Θ .*Toucher pour ouvrir/ }).click();
  await expect(page.getByRole("button", { name: /^Porte Θ .*: ouverte/ })).toBeVisible();
  // The dormitory too has its sheet (its rooms open their subject).
  await page.getByRole("button", { name: /^DORTOIR, porte fermée/ }).click();
  await page.getByRole("dialog", { name: "DORTOIR · Δ" }).getByRole("button", { name: "Ouvrir la porte" }).click();
  await expect(page.getByRole("button", { name: /^DORTOIR, porte ouverte/ })).toBeVisible();
  await page.getByRole("button", { name: "Fermer la fiche" }).click();

  // Then the scenario: prepared, loaded into the station (the room watches), launched.
  await page.getByRole("button", { name: "PROTOCOLE", exact: true }).click();
  await page.getByLabel("Prénoms des joueurs, un par ligne").fill(NAMES.join("\n"));
  await page.getByRole("button", { name: "Enregistrer les 20 joueurs" }).click();
  await expect(page.getByText("JOUEURS ET CHAMBRES")).toBeVisible();
  // The texts come with the scenario: 70 of them, editable before the evening.
  await page.locator("summary", { hasText: /^TEXTES À LIRE/ }).click();
  await expect(page.getByText(/Fichier du scénario, version 0\.2 · 70 textes/)).toBeVisible();
  await page.getByRole("button", { name: /Charger Sang-froid dans la station/ }).click();
  await expect(screen.getByText("CHARGEMENT DU SCÉNARIO :")).toBeVisible({ timeout: 10_000 });
  await expect(screen.getByText("SANG-FROID")).toBeVisible();
  await page.getByRole("button", { name: /▶ Lancer la partie/ }).click({ timeout: 20_000 });
  await page.getByRole("button", { name: "▶ Lancer la partie", exact: true }).click();

  const tap = async (name: string | RegExp) => {
    await page.getByRole("button", { name }).first().click();
  };
  const open = async (title: string) => page.locator("summary", { hasText: new RegExp(`^${title}`) }).click();
  const reader = page.getByRole("dialog", { name: "Texte à lire" });
  await expect(page.getByText("Prologue du bus", { exact: true }).first()).toBeVisible(); // written down before reading
  // The game starts in the base the scenario expects: what was tried before doesn't follow.
  await page.getByRole("button", { name: "BASE", exact: true }).click();
  await expect(page.getByRole("button", { name: /^Porte Θ .*: fermée/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /^HALL, dans le noir/ })).toBeVisible();
  await page.getByRole("button", { name: /PROTOCOLE · SANG-FROID/ }).click();
  // The text of the moment, full screen on the phone, never on the projection.
  await bar.getByRole("button", { name: /Texte/ }).click();
  await expect(reader.getByText("PRO-01", { exact: false }).first()).toBeVisible();
  await reader.getByRole("button", { name: /Suivant/ }).click();
  await expect(reader.getByText(/PRO-02/).first()).toBeVisible();
  await reader.getByRole("button", { name: "Masquer" }).click();
  await expect(reader).toHaveCount(0);
  await tap("Arriver à la base");
  await expect(screen.getByText("— SECTEUR NON ÉCLAIRÉ —")).toBeVisible();

  // The arrival: the hall, the dormitory, the chief elected by moving.
  await tap(/Allumer le hall/);
  await tap(/Ouvrir le dortoir/);
  await tap("Joueur10 · ch. 10");
  await tap("Joueur11 · ch. 11");
  await tap(/Lancer le vote · 120 s/);
  await expect(screen.getByText("IDENTIFICATION DU CHEF DE MISSION REQUISE")).toBeVisible();
  await expect(screen.getByText("JOUEUR11", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Joueur10 · ch. 10", exact: true }).click();
  await expect(screen.getByText(/CHEF DE MISSION : JOUEUR10\. IDENTIFICATION ENREGISTRÉE\./)).toBeVisible();
  await bar.getByRole("button", { name: /Texte/ }).click();
  await expect(reader.getByRole("heading", { name: "Le chef est reconnu" })).toBeVisible();
  await expect(reader.locator("mark", { hasText: "Joueur10" }).first()).toBeVisible();
  await bar.getByRole("button", { name: /Texte/ }).click();

  // The base stays one gesture away during the game.
  await page.getByRole("button", { name: "BASE", exact: true }).click();
  await page.getByRole("button", { name: /^ALPHA/ }).click();
  await page.getByRole("button", { name: /Tenter d'ouvrir/ }).click();
  await expect(screen.getByText("ACCÈS REFUSÉ")).toBeVisible();
  await page.getByRole("button", { name: "Fermer la fiche" }).click();
  await page.getByRole("button", { name: /PROTOCOLE · SANG-FROID/ }).click();

  await page.getByLabel("Patient zéro").selectOption({ label: "Joueur01 · ch. 1" });
  await tap("Noter le patient zéro");
  await expect(page.getByText("Patient zéro : Joueur01", { exact: true })).toBeVisible();
  await tap("🌙 La nuit tombe");
  // Night 1: patient zero wakes, contaminates, kills; no dead's moment yet.
  await tap("Fait");
  await page.getByLabel("Personne contaminée").selectOption({ label: "Joueur03 · ch. 3" });
  await tap("Contaminer");
  await page.getByLabel("Victime").selectOption({ label: "Joueur04 · ch. 4" });
  await tap("Noter la victime");
  await tap("☀️ Le jour se lève");
  // The dead wait for the meneur: suspense first, then « Révéler ».
  await expect(page.getByText("La salle ne le sait pas encore.")).toBeVisible();
  await expect(screen.getByText("CETTE NUIT, SIGNAL PERDU :")).toHaveCount(0);
  await tap("Révéler le mort de la nuit");
  await expect(screen.getByText("CETTE NUIT, SIGNAL PERDU :")).toBeVisible();

  // Day 1: the two doors of the plan, the vote by moving, the airlock and its pistol.
  await tap(/Lancer le vote · 60 s/);
  await expect(screen.getByText("CHOIX DE LA PORTE")).toBeVisible();
  await expect(screen.getByText("FOUILLER L'ACCUEIL")).toBeVisible();
  await tap(/\+30 s/);
  await page.getByRole("button", { name: "Le sas et le hangar", exact: true }).click();
  await expect(page.getByText("3. Porte du jour : Le sas et le hangar.")).toBeVisible();
  await page.getByLabel("Porteur : Pistolet de détresse", { exact: true }).selectOption({ label: "Joueur05 · ch. 5" });
  await tap("Confier");
  await expect(page.getByText("Pistolet de détresse : Joueur05 · remis devant tous")).toBeVisible();
  await open("POUVOIRS");
  // A missed shot: the target was healthy, the shooter goes with them.
  await page.getByLabel("Cible du pistolet").selectOption({ label: "Joueur06 · ch. 6" });
  await tap(/Tir du pistolet/);
  await expect(screen.getByText("TIR SANS MOTIF. LE TIREUR EST EXCLU.")).toBeVisible();
  // The healthy chief exiled: everything locks.
  await page.getByLabel("Exilé par le vote").selectOption({ label: "Joueur10 · ch. 10" });
  await tap("Exiler");
  await expect(screen.getByText("SUJET 10 · JOUEUR10 : EXILÉ")).toBeVisible();
  await expect(page.getByText(/est exilé/)).toBeVisible();
  await expect(screen.getByText(/PERTE DE CONFIANCE\. CHEF DE MISSION ÉLIMINÉ SANS MOTIF\. VERROUILLAGE GÉNÉRAL\./)).toBeVisible();
  await expect(page.getByText("VERROUILLÉS", { exact: true })).toBeVisible();

  // Night 2: the dead choose tomorrow's event between two doors.
  await tap("🌙 La nuit tombe");
  await page.getByLabel("Personne contaminée").selectOption({ label: "Joueur07 · ch. 7" });
  await tap("Contaminer");
  await page.getByLabel("Victime").selectOption({ label: "Joueur08 · ch. 8" });
  await tap("Noter la victime");
  await expect(page.getByText(/Joueur08 \(victime de cette nuit\) ne vote pas/)).toBeVisible();
  await tap(/Lancer le vote · 60 s/);
  await expect(screen.getByText("LES MORTS CHOISISSENT")).toBeVisible();
  await page.getByRole("button", { name: "Délestage", exact: true }).click();
  await tap("☀️ Le jour se lève");
  await expect(screen.getByText("— DÉLESTAGE · SEULE LA LAMPE ÉCLAIRE —")).toBeVisible({ timeout: 15_000 });
  await open("JOURNAL");
  await expect(page.getByText(/Les morts choisissent : Délestage \(contre/)).toBeVisible();

  await page.getByText("Terminer la boucle autrement").click();
  await tap("Victoire de la meute");
  await tap(/Reboot : boucle 2/);
  await tap("Arriver à la base");
  // Loop 2: the chief to confirm on the hall's terminal, the pistol to hand out again, the dead sealed.
  await expect(screen.getByText(/CHEF DE MISSION : JOUEUR10\./)).toBeVisible();
  await tap("Confirmer");
  await expect(page.getByText("OBJETS À REDISTRIBUER")).toBeVisible();
  await expect(screen.getByText("SCELLÉE").first()).toBeVisible();
  await page.getByLabel("Patient zéro").selectOption({ label: "Joueur02 · ch. 2" });
  await tap("Noter le patient zéro");

  // Up to day 3 of loop 2: the laboratory, imposed; without the badge, Marga forces it.
  await page.getByText("Sauter à une autre phase…").click();
  const jump = async (phase: string) => {
    await page.getByLabel("Phase").selectOption({ label: phase });
    await tap("Sauter");
    await expect(page.getByLabel("Phase")).toHaveValue(""); // written down: the select is free again
  };
  for (const phase of ["La nuit", "Le jour", "La nuit", "Le jour", "La nuit", "Le jour"]) await jump(phase);
  await expect(page.getByText("Boucle 2 · Jour 3").first()).toBeVisible();
  await tap(/Marga force la porte/);
  await expect(screen.getByText("ACCÈS FORCÉ · LABORATOIRE")).toBeVisible();

  // SUJETS.DAT, built from the players: last loop's dead are written down, no side ever.
  await open("FAILLES");
  await tap(/Les dossiers sujets/);
  await expect(screen.getByText(/REGISTRE DES SUJETS — SESSION 02/)).toBeVisible({ timeout: 10_000 });
  await expect(screen.getByText(/SESSION 01 : EXCLU/).first()).toBeVisible({ timeout: 15_000 });
  // FAILLE-01, small, without hiding the console.
  await expect(page.getByText("FAILLE-01")).toBeVisible();

  await jump("La nuit");
  await jump("Le jour");
  await tap("3. Le village vote contre le meneur");
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
  // Phone and projection side by side, then the console alone for the checks.
  await expect(page).toHaveURL(/\/scenario\/[A-Z0-9]{6}\/repetition$/);
  await expect(page.locator('iframe[title="Projection"]')).toBeVisible();
  await page.goto(page.url().replace(/repetition$/, "console"));
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

test("antarctica: the meneur keeps control — faults off, Stop, black screen, back in time", async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  await page.goto("/jeux/loups/scenarios");
  if (await page.getByLabel("Mot de passe du scénario").count()) {
    await page.getByLabel("Mot de passe du scénario").fill("APE26");
    await page.getByRole("button", { name: "Ouvrir le scénario" }).click();
  }
  await page.locator('select[name="start"]').selectOption("b1-day3");
  await page.getByRole("button", { name: "🧪 Simuler une partie" }).click();
  await expect(page).toHaveURL(/repetition$/);
  await page.goto(page.url().replace(/repetition$/, "console"));
  await expect(page.getByText("Boucle 1 · Jour 3").first()).toBeVisible();
  const bar = page.getByRole("navigation", { name: "Commandes" });
  await bar.getByRole("button", { name: /Écran/ }).click();
  await expect(page.getByText("QR code de la projection (autre appareil)")).toBeVisible();
  await page.getByRole("button", { name: "Fermer la fiche" }).click();

  await page.locator("summary", { hasText: /^FAILLES/ }).click();
  // The switch follows the journal: it flips once the server has written it down.
  await page.getByLabel("Toutes les failles").click();
  await expect(page.getByRole("button", { name: /Glitch d'en-tête/ })).toBeDisabled();
  await page.getByLabel("Toutes les failles").click();
  await expect(page.getByRole("button", { name: /Glitch d'en-tête/ })).toBeEnabled();

  await bar.getByRole("button", { name: /Écran/ }).click();
  await page.getByRole("button", { name: /^En attente/ }).click();
  await expect(bar.getByRole("button", { name: /Écran/ })).toContainText("en attente");
  await page.getByRole("button", { name: "Fermer la fiche" }).click();
  await bar.getByRole("button", { name: /Stop/ }).click();
  await page.locator("summary", { hasText: /^JOURNAL/ }).click();
  await expect(page.getByText(/Stop : tout s'arrête/)).toBeVisible();

  await page.getByText("Revenir à un moment passé…").click();
  await page.getByRole("button", { name: "↺ Boucle 1 · Nuit 2" }).click();
  await page.getByRole("button", { name: "Revenir à ce moment" }).click();
  await expect(page.getByText("Boucle 1 · Nuit 2").first()).toBeVisible();

  // A live evening can be deleted from its console.
  await page.getByRole("button", { name: "Supprimer cette soirée" }).click();
  await page.getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page).toHaveURL(/\/jeux\/loups\/scenarios$/);
  void browser;
  void baseURL;
});
