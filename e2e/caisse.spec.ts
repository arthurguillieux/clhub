import { test, expect } from "@playwright/test";
import { createTestMember } from "./helpers/db";

const MEMBER1_NAME = "e2e-member1"; // SignInForm defaults the display name to the email's local part

/**
 * Reproduces Arthur's own worked example from the design discussion: a
 * 2-share household pays 60€, a 1-share solo member pays 20€ — the fair
 * split is 53.33€/26.67€ (largest-remainder rounding), so the household is
 * owed exactly 6.67€. Exercises the whole event → expenses → balance →
 * settle chain through the real UI, not just the domain unit tests.
 */
test("Tricount event: split math and settling matches the hand-computed example", async ({ page }) => {
  await createTestMember("Solo Member", "e2e-solo@example.com");

  await page.goto("/caisse/new");
  await page.getByLabel("Nom de l'évènement *").fill("Camping E2E");

  await page.getByLabel(MEMBER1_NAME, { exact: true }).check();
  await page.getByLabel(`Parts pour ${MEMBER1_NAME}`).fill("2");

  await page.getByLabel("Solo Member", { exact: true }).check();
  await page.getByLabel("Parts pour Solo Member").fill("1");

  await page.getByRole("button", { name: "Créer l'évènement" }).click();
  await expect(page).toHaveURL(/\/caisse\/[0-9a-f-]+$/);

  // First expense: the signed-in member (household, 2 shares) pays 60€ —
  // "Payé par" already defaults to whoever is signed in.
  await page.getByLabel("Montant (€) *").fill("60");
  await page.getByLabel("Pour quoi ? *").fill("Emplacement + courses");
  await page.getByRole("button", { name: "Ajouter la dépense" }).click();
  await expect(page.getByText("Emplacement + courses")).toBeVisible();

  // Second expense: Solo Member (1 share) pays 20€.
  await page.getByLabel("Montant (€) *").fill("20");
  await page.getByLabel("Payé par *").selectOption({ label: "Solo Member" });
  await page.getByLabel("Pour quoi ? *").fill("Essence");
  await page.getByRole("button", { name: "Ajouter la dépense" }).click();
  await expect(page.getByText("Essence")).toBeVisible();

  await expect(page.getByText("Doit recevoir 6.67 €")).toBeVisible();
  await expect(page.getByText("Doit 6.67 €")).toBeVisible();
  await expect(page.getByText(/doit verser.*6.67.*€/)).toBeVisible();

  await page.getByRole("button", { name: "Marquer réglé" }).click();
  await expect(page.getByText("Réglé")).toHaveCount(2);
});
