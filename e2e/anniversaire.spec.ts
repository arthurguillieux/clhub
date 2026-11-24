import { test, expect, type Browser, type Page } from "@playwright/test";
import { createTestMember } from "./helpers/db";
import { waitForLoggedUrl } from "./helpers/log";

/** A second session for a seeded member, through the real magic link. */
async function signInAs(browser: Browser, baseURL: string, email: string): Promise<Page> {
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/sign-in");
  await page.getByLabel("Ton adresse mail").fill(email);
  await page.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();
  await expect(page.getByText("Vérifie ta boîte mail")).toBeVisible();
  await page.goto(await waitForLoggedUrl(`Magic link for ${email}:`));
  await page.waitForURL((url) => !url.pathname.startsWith("/sign-in"));
  return page;
}

/**
 * « Un anniversaire »: the whole round (ideas, thumbs, decide, buy, split, repay), and above all
 * the secret — the member celebrated sees nothing anywhere, not even by typing the address.
 */
test("anniversaire: ideas, thumbs, decide, buy, equal split — and the honoree sees nothing", async ({ page, browser, baseURL }) => {
  await createTestMember("Morgane Fêtée", "e2e-morgane@example.com");
  await createTestMember("Paul Complice", "e2e-paul@example.com");

  // Member 1 prepares Morgane's birthday with Paul.
  await page.goto("/celebrer/anniversaires/nouveau");
  await page.getByLabel("Le membre qu'on fête").selectOption({ label: "Morgane Fêtée" });
  await expect(page.getByText("Morgane Fêtée ne verra rien")).toBeVisible();
  // She can't be invited to her own surprise.
  await expect(page.getByRole("checkbox", { name: "Morgane Fêtée" })).toHaveCount(0);
  await page.getByLabel("La date de l'anniversaire").fill("2030-03-12");
  await page.getByRole("checkbox", { name: "Paul Complice" }).check();
  await page.getByRole("button", { name: "Préparer l'anniversaire" }).click();
  await expect(page.getByRole("heading", { name: "Anniversaire de Morgane Fêtée" })).toBeVisible();
  const birthdayUrl = page.url();

  // Ideas and thumbs.
  await page.getByRole("button", { name: "＋ Proposer une idée" }).click();
  await page.getByLabel("L'idée").fill("Coffret de thés");
  await page.getByRole("button", { name: "Ajouter l'idée" }).click();
  await expect(page.getByRole("button", { name: /Retirer mon pouce de « Coffret de thés » \(1\)/ })).toBeVisible();
  await page.getByRole("button", { name: "＋ Proposer une idée" }).click();
  await page.getByLabel("L'idée").fill("Places de concert");
  await page.getByLabel("Prix environ (€, facultatif)").fill("60");
  await page.getByRole("button", { name: "Ajouter l'idée" }).click();
  await expect(page.getByText("environ 60,00 €")).toBeVisible();

  // Paul is in on it: he sees it, likes the concert and takes part.
  const paul = await signInAs(browser, baseURL!, "e2e-paul@example.com");
  await paul.goto("/");
  await expect(paul.getByText(/prépare l'anniversaire de Morgane Fêtée/)).toBeVisible();
  await paul.goto(birthdayUrl);
  await paul.getByRole("button", { name: /Mettre un pouce à « Places de concert »/ }).click();
  await expect(paul.getByRole("button", { name: /Retirer mon pouce de « Places de concert » \(2\)/ })).toBeVisible();
  await paul.getByRole("button", { name: "Je participe" }).click();
  await expect(paul.getByRole("button", { name: "Je participe" })).toHaveAttribute("aria-pressed", "true");

  // Member 1 decides, takes charge and enters the price.
  await page.reload();
  await page.getByRole("button", { name: "Retenir cette idée" }).nth(0).click();
  await expect(page.getByText("🎁 Places de concert")).toBeVisible();
  await page.getByRole("button", { name: "Je m'en charge" }).click();
  await page.getByLabel("Prix payé (€)").fill("59,90");
  await page.getByRole("button", { name: "C'est acheté" }).click();
  await expect(page.getByText(/59,90\s€ partagés entre 2 participants : 29,95\s€ chacun/)).toBeVisible();

  // Paul sees his part and repays.
  await paul.reload();
  await expect(paul.getByText(/Ta part : 29,95\s€, à rembourser à/)).toBeVisible();
  await paul.getByRole("button", { name: "J'ai remboursé" }).click();
  await expect(paul.getByRole("button", { name: "Remboursé ✓" })).toBeVisible();

  // The secret: Morgane sees nothing, anywhere.
  const morgane = await signInAs(browser, baseURL!, "e2e-morgane@example.com");
  await morgane.goto("/");
  // (The generic « Nouveautés » card may mention the module: nothing about *her* birthday.)
  await expect(morgane.locator("body")).not.toContainText("prépare l'anniversaire");
  await expect(morgane.locator("body")).not.toContainText("Anniversaire de Morgane");
  await expect(morgane.locator("body")).not.toContainText("Coffret");
  await morgane.goto("/celebrer");
  await expect(morgane.getByText("Les fêtes du club")).toBeVisible();
  await expect(morgane.locator("body")).not.toContainText("Anniversaire de Morgane");
  await morgane.goto("/celebrer/anniversaires");
  await expect(morgane.getByText("Aucun anniversaire en préparation avec toi")).toBeVisible();
  // Typing the address gives the very same « page introuvable » as a wrong one.
  await morgane.goto(birthdayUrl);
  await expect(morgane.getByText("Ce ne sont pas les octets que vous cherchez.")).toBeVisible();
  await expect(morgane.locator("body")).not.toContainText("Coffret");
});
