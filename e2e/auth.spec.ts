import { test, expect } from "@playwright/test";
import { waitForLoggedUrl } from "./helpers/log";

/**
 * Member 1 is already signed in (see auth.setup.ts, the bootstrap path).
 * This exercises the other half of the identity chain every real new
 * member goes through: an existing member invites a fresh email, and that
 * invitation itself is what lets a brand-new person sign in — no password
 * ever exists in this app.
 */
test("an existing member invites a friend, who signs in through that invitation", async ({
  page,
  browser,
}) => {
  const friendEmail = "e2e-member2@example.com";

  await page.goto("/invite");
  await expect(page.getByText("membre #1")).toBeVisible();

  await page.getByLabel("Adresse mail à inviter").fill(friendEmail);
  await page.getByRole("button", { name: "Inviter", exact: true }).click();
  await expect(page.getByText("Invitation envoyée.")).toBeVisible();
  const invitationUrl = await page.locator("code").textContent();
  expect(invitationUrl).toMatch(/^https?:\/\//);

  // A genuinely separate person: a fresh context with no cookies, ignoring
  // the project's pre-authenticated storageState.
  const friendContext = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const friendPage = await friendContext.newPage();

  await friendPage.goto(invitationUrl!);
  await expect(friendPage.getByLabel("Ton adresse mail")).toHaveValue(friendEmail);
  await friendPage.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();
  await expect(friendPage.getByText("Vérifie ta boîte mail")).toBeVisible();

  const magicLink = await waitForLoggedUrl(`Magic link for ${friendEmail}:`);
  await friendPage.goto(magicLink);

  await expect(friendPage).toHaveURL(/\/invite/);
  await expect(friendPage.getByText("membre #2")).toBeVisible();

  await friendContext.close();
});
