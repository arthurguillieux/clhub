import { test, expect } from "@playwright/test";
import { Client } from "pg";

/** « Signaler un bug »: from the profile menu, the page already noted, the report sent. */
test("a member reports a bug from the page they're on", async ({ page }) => {
  await page.goto("/jeux");
  await page.getByRole("button", { expanded: false }).filter({ hasText: /e2e/i }).first().click();
  await page.getByRole("link", { name: "🐞 Signaler un bug" }).click();
  await expect(page).toHaveURL(/\/signaler\?page=%2Fjeux$/);
  await expect(page.getByLabel("La page concernée")).toHaveValue("/jeux");
  await page.getByLabel("Ce qui s'est passé").fill("Le bouton ne répond pas quand je touche « Lancer ».");
  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByText("Merci, c'est envoyé ✓")).toBeVisible();
});

test("the admin sorts the reports out and copies them for Claude", async ({ page, context }) => {
  // The e2e member becomes an admin, then unlocks with the test server's own code.
  const db = new Client({ connectionString: "postgresql://clhub:clhub@localhost:5432/clhub_e2e" });
  await db.connect();
  await db.query("update member set role = 'admin' where id = (select m.id from member m join \"user\" u on u.id = m.user_id where u.email like 'e2e-member1%' limit 1)");
  await db.end();
  await page.goto("/signaler?page=/jeux/loups");
  await page.getByLabel("Ce qui s'est passé").fill("La partie ne se lance pas à 9 joueurs.");
  await page.getByRole("button", { name: "Envoyer le signalement" }).click();
  await expect(page.getByText("Merci, c'est envoyé ✓")).toBeVisible();

  await page.goto("/");
  const logo = page.getByRole("link", { name: /LE CLHUB/ }).first();
  for (let i = 0; i < 3; i++) await logo.click();
  await page.locator('input[name="code"]').fill("e2e-admin-code");
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page.locator('input[name="code"]')).toHaveCount(0, { timeout: 15_000 });
  await page.goto("/admin/bugs");
  await expect(page.getByRole("heading", { name: "Signalements", exact: true })).toBeVisible();
  await expect(page.getByText("La partie ne se lance pas à 9 joueurs.")).toBeVisible();
  await page.getByLabel("Verdict").first().selectOption({ label: "Bug confirmé" });
  await page.getByRole("button", { name: "Enregistrer le verdict" }).first().click();
  await expect(page.getByRole("button", { name: "Enregistré ✓" }).first()).toBeVisible();
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "📋 Copier pour Claude" }).click();
  await expect(page.getByText(/Copié : colle-le/)).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toContain("La partie ne se lance pas à 9 joueurs.");
  // The admin hears of it on the home page too.
  await page.goto("/");
  await expect(page.getByText(/🐞 .* signale un bug sur \/jeux\/loups/).first()).toBeVisible();
});
