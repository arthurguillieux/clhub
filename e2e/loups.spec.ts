import { test, expect } from "@playwright/test";

/**
 * Loups-garous end to end: the meneur sets a table of five and the proposed deck, the CLHUB deals,
 * a player with no account claims their name and turns their card over, the first night goes by,
 * the dawn kills the wolves' victim, the village votes, the game ends and counts in the stats.
 * The rules themselves (deaths, lovers, victory) are tested in modules/loups/domain.
 */
test("loups-garous: table, deck, draw, a night, a day, the end", async ({ page, browser, baseURL }) => {
  await page.goto("/jeux/loups");
  await page.getByRole("button", { name: "🐺 Nouvelle partie" }).click();
  await expect(page).toHaveURL(/\/loups\/[A-Z0-9]{6}\/meneur$/);

  for (const name of ["Ana", "Ben", "Cléo", "Dan", "Eli"]) {
    await page.getByLabel("Prénom du joueur").fill(name);
    await page.getByRole("button", { name: "Ajouter", exact: true }).first().click();
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();
  }
  await expect(page.getByText("Le deck · 6 cartes")).toBeVisible(); // the core of five, and one spare card for « peste noire »
  await page.getByLabel(/Peste noire/).uncheck();
  await expect(page.getByText("Le deck · 5 cartes")).toBeVisible();
  await page.getByLabel(/Le CLHUB tire les cartes au sort/).check();
  await page.getByRole("button", { name: "🐺 Lancer la partie" }).click();
  await expect(page.getByText(/Les cartes · 0 sur 5 vues/)).toBeVisible();

  // A player, no account: the link, « c'est moi », the card.
  const link = await page.evaluate(() => document.querySelector("[data-player-link]")?.getAttribute("data-player-link"));
  expect(link).toMatch(/\/loups\/partie\/[\w-]+$/);
  const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const phone = await ctx.newPage();
  await phone.goto(link!);
  await expect(phone.getByText("Les cartes de la partie")).toBeVisible();
  await phone.getByRole("button", { name: "Ana", exact: true }).click();
  await phone.getByRole("button", { name: "Oui, je suis Ana" }).click();
  await phone.getByRole("button", { name: "Voir ma carte" }).click();
  await expect(phone.getByRole("button", { name: "Cacher ma carte" }).first()).toBeVisible();
  await ctx.close();
  await expect(page.getByText(/Les cartes · 1 sur 5 vues/)).toBeVisible({ timeout: 10_000 });

  // The first night: the wolves pick Ana, nobody saves her.
  await page.getByRole("button", { name: /la nuit tombe/ }).click();
  await expect(page.getByRole("heading", { name: /Nuit 1/ })).toBeVisible();
  const wolves = page.locator("article", { hasText: "Les loups-garous" });
  const wolfName = (await wolves.locator("p", { hasText: "🐺" }).innerText()).replace("🐺", "").trim();
  const victim = ["Ana", "Ben", "Cléo", "Dan", "Eli"].find((n) => n !== wolfName)!;
  await wolves.getByLabel("Victime des loups").selectOption({ label: victim });
  await page.getByRole("button", { name: "☀️ Le jour se lève" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText(victim);
  await dialog.getByRole("button", { name: "Annoncer au village" }).click();
  await expect(page.getByRole("heading", { name: /Jour 1/ })).toBeVisible();

  // The day: the village votes the wolf out, and the CLHUB sees the village has won.
  await page.getByLabel("Joueur éliminé par le vote").selectOption({ label: wolfName });
  await page.getByRole("button", { name: "Valider le vote" }).click();
  await expect(page.getByText("🏁 Victoire du village ?")).toBeVisible();
  await page.getByRole("button", { name: "Terminer la partie" }).first().click();
  await page.getByRole("dialog").getByRole("button", { name: /Terminer : victoire du village/ }).click();
  await expect(page.getByRole("heading", { name: /Victoire du village/ })).toBeVisible();

  await page.goto("/jeux/loups");
  await expect(page.getByText(/parties? menées?/)).toBeVisible();
  await expect(page.getByRole("cell", { name: wolfName })).toBeVisible();

  // A test game can go, and leaves the stats with it.
  await page.getByRole("link", { name: "Revoir" }).first().click();
  await page.getByRole("button", { name: "Supprimer cette partie" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Supprimer définitivement" }).click();
  await expect(page).toHaveURL(/\/jeux\/loups$/);
});
