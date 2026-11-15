import { test, expect } from "@playwright/test";

/**
 * « Ma lettre au Père Noël » end to end: an organizer writes the letter, adds a gift and a cagnotte,
 * and sends the one link; someone of the family with no account opens the envelope, gives the gift
 * and promises a part; someone else sees who gives what but no amount, and can't go past the
 * cagnotte's total; the organizer sees it all. Who may take what, and the races, are tested against
 * the database in modules/lettre/data.
 */
test("lettre au père noël: letter, gifts, one link, the family gives and promises", async ({ page, browser, baseURL }) => {
  await page.goto("/jeux/lettre");
  await page.getByLabel("Prénom de l'enfant").fill("Ana");
  await page.getByRole("button", { name: "Créer la lettre" }).click();
  await expect(page).toHaveURL(/\/lettre\/[A-Z0-9]{6}\/panneau$/);
  await expect(page.getByRole("heading", { name: /Lettre au Père Noël d'Ana \d{4}/ })).toBeVisible();
  await expect(page.locator("main.santa-blanc")).toBeVisible();

  await page.getByLabel("Ce qu'Ana écrit au Père Noël").fill("Cher Père Noël, je voudrais une toupie.");
  await page.getByLabel("Pour envoyer sa part d'une cagnotte").fill("Par Wero au 06 00 00 00 00");
  await page.getByRole("button", { name: "Enregistrer la lettre" }).click();
  await expect(page.getByRole("button", { name: "Lettre enregistrée ✓" })).toBeVisible();

  await page.getByRole("button", { name: "➕ Ajouter un cadeau" }).click();
  await page.getByLabel("Le cadeau").fill("Toupie en bois");
  await page.getByLabel("Prix indicatif").fill("12");
  await page.getByLabel(/préférés d'Ana/).check();
  await page.getByRole("button", { name: "Ajouter le cadeau" }).click();
  await expect(page.getByText("Personne ne l'offre encore.")).toBeVisible();

  await page.getByRole("button", { name: "➕ Ajouter un cadeau" }).click();
  await page.getByLabel("Le cadeau").fill("Trottinette");
  await page.getByRole("radio", { name: /une cagnotte/ }).check();
  await page.getByLabel("Montant à réunir").fill("100");
  await page.getByRole("button", { name: "Ajouter le cadeau" }).click();
  await expect(page.getByText("0 € sur 100 €", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "💌 La lettre est prête : créer le lien" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Créer le lien" }).click();
  const link = await page.getByLabel("Lien de la lettre").inputValue();
  expect(link).toMatch(/\/lettre\/ouvrir\/[\w-]+$/);

  // Someone of the family, no account: the envelope first, then the gift and a part of the cagnotte.
  const firstContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const first = await firstContext.newPage();
  await first.goto(link);
  await first.getByRole("button", { name: "💌 Ouvrir la lettre" }).click();
  await expect(first.getByText("Cher Père Noël, je voudrais une toupie.")).toBeVisible();
  const toupie = first.locator("article", { hasText: "Toupie en bois" }).last();
  await toupie.getByRole("button", { name: "🎁 Je l'offre" }).click();
  await first.getByRole("dialog").getByLabel("Votre prénom").fill("Inès");
  await first.getByRole("dialog").getByRole("button", { name: "Je l'offre" }).click();
  await expect(toupie.getByText("C'est vous qui l'offrez")).toBeVisible();
  const scooter = first.locator("article", { hasText: "Trottinette" }).last();
  await scooter.getByRole("button", { name: "💶 Je participe" }).click();
  await expect(first.getByRole("dialog").getByLabel("Votre prénom")).toHaveValue("Inès");
  await first.getByRole("dialog").getByLabel("Votre part").fill("60");
  await first.getByRole("dialog").getByRole("button", { name: /Je promets 60/ }).click();
  await expect(first.getByText("Ce que vous offrez")).toBeVisible();
  await expect(first.getByText("Pour envoyer votre part")).toBeVisible();
  await firstContext.close();

  // Someone else: who gives what, no amount, and no way past the total.
  const otherContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const other = await otherContext.newPage();
  await other.goto(link);
  await other.getByRole("button", { name: "💌 Ouvrir la lettre" }).click();
  await expect(other.locator("article", { hasText: "Toupie en bois" }).last()).toContainText("Offert par Inès");
  const pot = other.locator("article", { hasText: "Trottinette" }).last();
  await expect(pot).toContainText("60 € sur 100 €");
  await expect(pot).toContainText("Avec la participation d'Inès");
  await pot.getByRole("button", { name: "💶 Je participe" }).click();
  await other.getByRole("dialog").getByLabel("Votre prénom").fill("Hugo");
  await other.getByRole("dialog").getByLabel("Votre part").fill("50");
  await other.getByRole("dialog").getByRole("button", { name: /Je promets/ }).click();
  await expect(other.getByRole("dialog").getByRole("alert")).toContainText("Il ne manque plus que 40");
  await otherContext.close();

  // The organizer sees every name and amount.
  await page.reload();
  await expect(page.getByText("Offert par Inès")).toBeVisible();
  await expect(page.locator("li", { hasText: "Trottinette" })).toContainText("60 €");
});
