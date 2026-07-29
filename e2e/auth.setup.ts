import { test as setup, expect } from "@playwright/test";
import { waitForLoggedUrl } from "./helpers/log";

const AUTH_FILE = "e2e/.auth-state.json";
export const MEMBER1_EMAIL = "e2e-member1@example.com";

/**
 * The empty-club bootstrap path (no invitation required for the very first
 * member) only works once per database — every other test reuses this
 * saved session instead of repeating it. auth.spec.ts still exercises the
 * full magic-link mechanics for a *second* member, invited by this one.
 */
setup("bootstrap first member and save session", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Ton adresse mail").fill(MEMBER1_EMAIL);
  await page.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();
  await expect(page.getByText("Vérifie ta boîte mail")).toBeVisible();

  const magicLink = await waitForLoggedUrl(`Magic link for ${MEMBER1_EMAIL}:`);
  await page.goto(magicLink);
  await expect(page).toHaveURL(/\/bienvenue/);

  await page.context().storageState({ path: AUTH_FILE });
});
