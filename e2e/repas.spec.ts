import { test, expect } from "@playwright/test";
import { createTestMember } from "./helpers/db";

/**
 * « Les potlucks du CLHUB » end to end: the organizer creates a raclette, the calculator makes the list,
 * a member and a friend without an account are invited; the friend opens the link, says who she is,
 * takes part of the cheese, changes her mind, gives it back, proposes an idea and removes it.
 */
test("repas: a raclette, the calculator, a guest without an account takes her part", async ({ page, browser, baseURL }) => {
  const stamp = Date.now();
  await createTestMember(`Zoé ${stamp}`, `e2e-repas-${stamp}@example.test`);
  const day = new Date(Date.now() + 20 * 86_400_000).toISOString().slice(0, 10);

  await page.goto("/menus");
  await expect(page).toHaveURL(/\/repas$/);
  await expect(page.getByRole("heading", { name: "Les potlucks du CLHUB" })).toBeVisible();
  await page.getByRole("link", { name: "+ Organiser un potluck" }).click();
  await page.getByLabel("Le repas").fill(`Raclette ${stamp}`);
  await page.getByLabel("Le jour").fill(day);
  await page.getByLabel("Où").fill("Chez Marine");
  await page.getByRole("button", { name: "Créer le repas" }).click();
  await expect(page).toHaveURL(/\/repas\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { name: `Raclette ${stamp}` })).toBeVisible();

  // Nothing taken yet: the joke. Then the calculator: 6 non-végés, 2 végés.
  await expect(page.getByText(/^« .+ »$/)).toBeVisible();
  const meatPlus = page.getByRole("button", { name: "🥩 Non-végés : un de plus" });
  const meat = page.getByText("🥩 Non-végés").locator("xpath=..").locator("b");
  await expect(meat).toHaveText(/^\d+$/);
  while (Number(await meat.textContent()) < 6) await meatPlus.click();
  await page.getByRole("button", { name: "🥕 Végés : un de plus" }).click();
  await page.getByRole("button", { name: "🥕 Végés : un de plus" }).click();
  await expect(page.getByLabel("Quantité de Fromage à raclette")).toHaveValue("1,6");
  await page.getByRole("button", { name: "Enlever Oignons grelots" }).click();
  await page.getByRole("button", { name: /^Ajouter ces \d+ lignes à la liste$/ }).click();
  const cheese = page.locator('[id^="ligne-"]').filter({ hasText: "Fromage à raclette" });
  await expect(cheese).toContainText("1,6 kg");
  await expect(page.locator('[id^="ligne-"]').filter({ hasText: "Oignons grelots" })).toHaveCount(0);

  // The organizer takes the gherkins: no more joke.
  await page.locator('[id^="ligne-"]').filter({ hasText: "Cornichons" }).getByRole("button", { name: "Je ramène tout" }).click();
  await expect(page.getByRole("region", { name: "Ce que tu ramènes" }).getByText("Cornichons")).toBeVisible();

  // Invite a member and a friend without an account.
  await page.getByRole("button", { name: "+ Inviter du monde" }).click();
  await page.getByRole("button", { name: `Zoé ${stamp}` }).click();
  await page.getByLabel("Des personnes sans compte").fill("Léa");
  await page.getByRole("button", { name: "Inviter 2 personnes" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: /^Léa/ })).toContainText("pas de réponse");
  const link = await page.getByLabel("Le lien du repas").inputValue();
  expect(link).toMatch(/\/repas\/invitation\/[\w-]+$/);

  // Léa, on her phone, without an account.
  const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const lea = await other.newPage();
  await lea.goto(new URL(new URL(link).pathname, baseURL).toString());
  await expect(lea.getByText("Qui es-tu ?")).toBeVisible();
  await lea.getByRole("button", { name: "Léa", exact: true }).click();
  await lea.getByRole("button", { name: "Oui, c'est moi" }).click();
  await expect(lea.getByText("Ce que tu ramènes, Léa")).toBeVisible();
  await lea.getByRole("button", { name: "Je viens" }).click();
  await expect(lea.getByRole("button", { name: "Je viens" })).toHaveAttribute("aria-pressed", "true");

  // Part of the cheese, then more, then none.
  const leaCheese = lea.locator('[id^="ligne-"]').filter({ hasText: "Fromage à raclette" });
  await leaCheese.getByRole("button", { name: "J'en ramène…" }).click();
  await leaCheese.getByLabel("Combien de Fromage à raclette").fill("0,8");
  await leaCheese.getByRole("button", { name: "Je ramène ça" }).click();
  await expect(leaCheese).toContainText("il manque 0,8 kg");
  await expect(lea.getByRole("region", { name: "Ce que tu ramènes" })).toContainText("Fromage à raclette · 0,8 kg");
  await leaCheese.getByRole("button", { name: "Changer la quantité" }).click();
  await leaCheese.getByLabel("Combien de Fromage à raclette").fill("1");
  await leaCheese.getByRole("button", { name: "Je ramène ça" }).click();
  await expect(leaCheese).toContainText("il manque 0,6 kg");
  await leaCheese.getByRole("button", { name: "Je ne le ramène plus" }).click();
  await expect(leaCheese).toContainText("il manque 1,6 kg");
  await expect(lea.getByText(/^« .+ »$/)).toBeVisible();
  // She can't touch the organizer's lines…
  await expect(leaCheese.getByRole("button", { name: /Modifier ou retirer/ })).toHaveCount(0);
  // …but proposes an idea, and removes it.
  await lea.getByRole("button", { name: "+ Proposer une idée" }).click();
  await lea.getByLabel("Ce qu'il faut ramener").fill("Tiramisu");
  await lea.getByRole("button", { name: "Ajouter à la liste" }).click();
  await lea.getByRole("button", { name: "Modifier ou retirer « Tiramisu »" }).click();
  await lea.getByRole("button", { name: "Retirer cette ligne" }).click();
  await lea.getByRole("alertdialog", { name: "Retirer « Tiramisu » ?" }).getByRole("button", { name: "Retirer la ligne" }).click();
  await expect(lea.locator('[id^="ligne-"]').filter({ hasText: "Tiramisu" })).toHaveCount(0);
  // She takes the rest of the potatoes for good.
  await lea.locator('[id^="ligne-"]').filter({ hasText: "Pommes de terre" }).getByRole("button", { name: "Je ramène tout" }).click();
  await expect(lea.getByRole("region", { name: "Ce que tu ramènes" })).toContainText("Pommes de terre");
  await other.close();

  // The organizer sees it.
  await page.reload();
  await expect(page.getByRole("listitem").filter({ hasText: /^Léa/ })).toContainText("vient");
  await expect(page.locator('[id^="ligne-"]').filter({ hasText: "Pommes de terre" })).toContainText("✓ pris");
});
