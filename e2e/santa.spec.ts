import { test, expect, type Page } from "@playwright/test";
import { waitForLoggedUrl } from "./helpers/log";

async function addGuest(page: Page, name: string, email: string) {
  await page.getByLabel("Prénom de l'invité").fill(name);
  await page.getByLabel("Adresse mail de l'invité").fill(email);
  await page.getByRole("button", { name: "Ajouter", exact: true }).last().click();
  await expect(page.getByText(email)).toBeVisible();
}

/**
 * The Secret Santa end to end: an organizer sets it up with guests and an exclusion rule the draw
 * can't satisfy until a fourth person joins, launches it, a guest with no account opens their gift
 * and writes their letter; the organizer sees nothing of the draw until they unmask it, archives
 * the event and starts next year's. The draw itself is unit-tested in modules/santa/domain.
 */
test("secret santa: setup, exclusion, launch, gift, unmask, archive, next year", async ({ page, browser, baseURL }) => {
  await page.goto("/jeux/santa");
  await page.getByLabel("Nom du Secret Santa").fill("Noël 2026");
  await page.getByRole("button", { name: "Organiser un Secret Santa" }).click();
  await expect(page).toHaveURL(/\/santa\/[A-Z0-9]{6}\/panneau$/);

  await addGuest(page, "Alice", "alice@example.com");
  await addGuest(page, "Bob", "bob@example.com");
  await addGuest(page, "Chloé", "chloe@example.com");

  // With three people, keeping Alice and Bob apart leaves no possible draw.
  await page.getByLabel("Qui", { exact: true }).selectOption({ label: "Alice" });
  await page.getByLabel("Avec qui").selectOption({ label: "Bob" });
  await page.getByRole("button", { name: "Ajouter la règle" }).click();
  await expect(page.getByText("Alice et Bob ne peuvent pas se tirer")).toBeVisible();
  await expect(page.getByText("Ces exclusions rendent le tirage impossible")).toBeVisible();
  await expect(page.getByRole("button", { name: /Lancer le tirage/ })).toBeDisabled();

  await addGuest(page, "Dan", "dan@example.com");
  await expect(page.getByText("Ces exclusions rendent le tirage impossible")).toBeHidden();

  await page.getByRole("button", { name: /Lancer le tirage/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Tirer au sort et envoyer les mails" }).click();
  await expect(page.getByText("Tirage effectué")).toBeVisible();

  // Alice has no account: her mail's link is all she needs.
  const link = await waitForLoggedUrl("Secret Santa link for alice@example.com:");
  const guestContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const guest = await guestContext.newPage();
  await guest.goto(link);
  await expect(guest.getByRole("heading", { name: "Salut Alice !" })).toBeVisible();
  await guest.getByRole("button", { name: "🎁 Ouvrir mon cadeau" }).click();
  await expect(guest.getByText("Alice, tu offres ton cadeau à")).toBeVisible();
  const drawn = (await guest.getByRole("heading", { level: 1 }).textContent())!.trim();
  expect(["Chloé", "Dan"]).toContain(drawn); // never herself, never Bob

  await guest.getByLabel("Ta lettre au Père Noël").fill("Cher Père Noël, un bon livre.");
  await guest.getByRole("button", { name: "Envoyer ma lettre" }).click();
  await expect(guest.getByText("Bien reçue au pôle Nord")).toBeVisible();
  await guestContext.close();

  // The organizer sees who opened their gift, not who drew whom — until they unmask it.
  await page.reload();
  await expect(page.getByText("ont ouvert leur cadeau")).toBeVisible();
  await expect(page.getByText(`Alice offre à ${drawn}`)).toBeHidden();
  const alice = page.getByRole("listitem").filter({ has: page.getByText("alice@example.com") });
  await alice.getByRole("button", { name: "Démasquer" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Oui, démasquer Alice" }).click();
  await expect(page.getByText(`Alice offre à ${drawn}`)).toBeVisible();
  await page.getByRole("button", { name: "J'ai vu, fermer" }).click();
  await expect(page.getByText("a regardé le tirage d'Alice")).toBeVisible();

  await page.getByRole("button", { name: "📦 Archiver" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Archiver", exact: true }).click();
  await expect(page).toHaveURL(/\/santa\/[A-Z0-9]{6}\/archive$/);
  await page.getByRole("button", { name: "🎭 Démasquer le tirage" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "Alice a offert à" })).toContainText(drawn);

  await page.getByRole("button", { name: "🎄 Refaire pour l'année suivante" }).click();
  await expect(page.getByRole("heading", { name: "Noël 2027" })).toBeVisible();
  await expect(page.getByText("Le tirage évitera de refaire celui de « Noël 2026 »")).toBeVisible();
  await expect(page.getByText("Alice et Bob ne peuvent pas se tirer")).toBeVisible();
});
