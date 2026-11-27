import { test, expect } from "@playwright/test";
import { waitForLoggedUrl } from "./helpers/log";

/**
 * « Nouvel an », the whole year: an edition from the spreadsheet's lists, a guest by email who answers
 * on their personal link (no account), takes on a mission and a line of the drinks; the quantities
 * follow who comes and for how long; the budget by option and presence; the request to pay, « j'ai
 * payé », the organizers' « reçu »; and next year's edition, taken over with the same guests.
 */
test("nouvel an: invite by mail, answer without an account, quantities, budget, payments, next year", async ({ page, browser, baseURL }) => {
  test.setTimeout(120_000);
  await page.goto("/celebrer/nouvel-an");
  await page.getByLabel("Titre").fill("Nouvel an 2026");
  await page.getByLabel("Du").fill("2026-12-31");
  await page.getByLabel("Au").fill("2027-01-02");
  await page.getByRole("button", { name: "Préparer ce nouvel an" }).click();
  await expect(page.getByRole("heading", { name: "Nouvel an 2026" })).toBeVisible();
  const editionUrl = page.url();

  // A guest outside the club, by email, and the invitation with their personal link.
  await page.getByLabel("Prénom de l'invité").fill("Camille");
  await page.getByLabel("Adresse mail de l'invité").fill("e2e-camille@example.com");
  await page.getByRole("button", { name: "Ajouter par mail" }).click();
  await expect(page.getByRole("button", { name: /^Camille/ })).toBeVisible();
  await page.getByRole("button", { name: "Envoyer les invitations (1)" }).click();
  await expect(page.getByText("1 invitation envoyée")).toBeVisible();
  const link = await waitForLoggedUrl("New Year link for e2e-camille@example.com:");

  // The organizers: how to pay, an option for the place, the place's estimate.
  const tabs = page.getByRole("navigation", { name: "Organisation" });
  await tabs.getByRole("button", { name: "Réglages" }).click();
  await page.getByLabel("Comment payer").fill("Wero au 06 00 00 00 00 (Justine)");
  await page.getByRole("button", { name: "Enregistrer les réglages" }).click();
  await expect(page.getByText("Réglages enregistrés")).toBeVisible();
  await tabs.getByRole("button", { name: "Budget" }).click();
  await page.getByLabel("Nouvelle option").fill("Chambre seule");
  await page.getByLabel("Prix de l'option").fill("76");
  await page.getByRole("button", { name: "Ajouter l'option" }).click();
  await page.getByLabel("Prévision : Le lieu").fill("150");
  await page.getByRole("button", { name: "Enregistrer" }).first().click();
  await expect(page.getByText("Poste enregistré")).toBeVisible();

  // Camille, without an account: she comes (two days of three), takes the single room, a mission, the beers.
  const ctx = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const guest = await ctx.newPage();
  await guest.goto(link);
  await expect(guest.getByText(/Bonjour Camille/)).toBeVisible();
  await guest.getByRole("button", { name: "Je viens" }).click();
  await expect(guest.getByRole("button", { name: "Je viens" })).toHaveAttribute("aria-pressed", "true");
  await guest.getByRole("button", { name: /2 janv/ }).click();
  await expect(guest.getByRole("button", { name: /2 janv/ })).toHaveAttribute("aria-pressed", "false");
  await guest.getByLabel("Ton option").selectOption({ label: "Chambre seule · 76,00 €" });
  await guest.getByLabel(/Régime, allergies/).fill("Végétarienne");
  await guest.getByRole("button", { name: "Enregistrer" }).click();
  await expect(guest.getByText("C'est noté pour les menus")).toBeVisible();
  await expect(guest.getByText(/Reste à verser/)).toBeVisible();
  await guest.locator("li", { hasText: "Playlist" }).getByRole("button", { name: "Je m'en charge" }).click();
  await expect(guest.locator("li", { hasText: "Playlist" }).getByRole("button", { name: "Je me retire" })).toBeVisible();
  await guest.locator("summary", { hasText: "Boissons" }).click();
  await guest.locator("li", { hasText: /^Bières ·/ }).getByRole("button", { name: "Je m'en occupe" }).click();
  await expect(guest.locator("li", { hasText: /^Bières ·/ }).getByText("acheté")).toBeVisible();

  // The quantities follow who comes and for how long: 3 days + 2 days = 5 days × 3,5 beers = 17,5 → one pack of 20.
  await page.goto(editionUrl);
  await tabs.getByRole("button", { name: "Listes" }).click();
  await expect(page.getByText(/^Bières · 1 lot de 20/)).toBeVisible();
  await expect(page.getByText(/Camille s'en occupe/)).toBeVisible();
  await expect(page.getByText(/soit 5 journées de présence/)).toBeVisible();

  // The budget: Camille's part, the request to pay, « j'ai payé », « reçu ».
  await tabs.getByRole("button", { name: "Budget" }).click();
  await expect(page.getByText(/il manque 74,00/)).toBeVisible(); // 150 € for the place, 76 € through Camille's option
  await page.getByRole("button", { name: "Envoyer la demande de participation" }).click();
  await expect(page.getByText(/demandes? envoyées?/)).toBeVisible();
  await waitForLoggedUrl("New Year link for e2e-camille@example.com:");
  await guest.reload();
  await guest.getByRole("button", { name: "J'ai payé" }).click();
  await expect(guest.getByText(/Tu as dit avoir payé/)).toBeVisible();
  await page.reload();
  await tabs.getByRole("button", { name: "Budget" }).click();
  const camille = page.locator("div.px-4", { hasText: /^Camille/ }).filter({ hasText: "dit avoir payé" });
  await expect(camille).toBeVisible();
  await camille.getByRole("button", { name: "Tout reçu" }).click();
  await expect(camille.getByText("réglé ✓")).toBeVisible();
  await guest.reload();
  await expect(guest.getByText("Tout est réglé ✓")).toBeVisible();

  // Next year: the same guests, waiting for their answer again.
  await page.goto("/celebrer/nouvel-an");
  await expect(page.getByLabel("Titre")).toHaveValue("Nouvel an 2027");
  await expect(page.getByLabel("À partir de")).toHaveValue(/[A-Z0-9]{6}/);
  await page.getByRole("button", { name: "Préparer ce nouvel an" }).click();
  await expect(page.getByRole("heading", { name: "Nouvel an 2027" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^Camille.*pas répondu/ })).toBeVisible();
  await ctx.close();
});
