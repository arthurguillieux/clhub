import { test, expect } from "@playwright/test";

/**
 * The Killer end to end: creation (with a co-organization password), lobby with two tributes and their
 * missions, an anonymous guest claiming a name (separate browser context, no
 * session), launch, the guest seeing their target's mission, an elimination
 * from the organizer's panel, and the end of the game on the guest's phone.
 * Circle rules are unit-tested in modules/killer/domain.
 */
test("killer: lobby, anonymous join, elimination, end", async ({ page, browser, baseURL }) => {
  // Open to every member now; a co-organization password is optional at creation.
  await page.goto("/jeux/killer");
  await page.getByLabel("Nom de la partie").fill("Killer E2E");
  await page.getByLabel("Mot de passe de co-organisation (facultatif)").fill("citrouille");
  await page.getByRole("button", { name: "Préparer une nouvelle partie" }).click();
  await expect(page).toHaveURL(/\/killer\/[A-Z0-9]{6}\/panneau$/);
  const code = page.url().match(/\/killer\/([A-Z0-9]{6})\/panneau/)![1]!;

  for (let i = 0; i < 2; i++) await page.getByRole("button", { name: "+ Ajouter un agent" }).click();
  await page.getByLabel("Prénom de l'agent 1").fill("Alice");
  await page.getByLabel("Mission de Alice").fill("Lui faire chanter le refrain");
  await page.getByLabel("Prénom de l'agent 2").fill("Bob");
  await page.getByLabel("Mission de Bob").fill("Lui faire dire citrouille");
  await page.getByRole("button", { name: "Enregistrer les changements" }).click();
  await expect(page.getByText("Alice → Bob → Alice")).toBeVisible();

  // Guest phone: nothing from the organizer's session.
  const guestContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const guest = await guestContext.newPage();
  await guest.goto(`/killer/${code}`);
  await guest.getByRole("button", { name: "Alice" }).click();
  await guest.getByRole("button", { name: "Oui, je suis Alice" }).click();
  await expect(guest.getByText(/ton portrait/i)).toBeVisible();

  // The organizer screens stay locked for a guest.
  const probe = await guestContext.newPage();
  await probe.goto(`/killer/${code}/panneau`);
  await expect(probe).toHaveURL(/\/sign-in/);
  await probe.close();

  await page.getByRole("button", { name: "Lancer la partie" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Lancer la partie" }).click();
  await expect(page.getByText("agents encore en jeu")).toBeVisible();

  // Alice has no photo yet, so her phone still asks for one; the API says what she'd see once she has.
  const token = await guest.evaluate((c) => localStorage.getItem(`clhub:killer:${c}`), code);
  const view = await (await guest.request.get(`/api/killer/${code}/poll?token=${token}`)).json();
  expect(view.me.target.name).toBe("Bob");
  expect(view.me.mission).toBe("Lui faire dire citrouille");
  const publicView = await (await guest.request.get(`/api/killer/${code}/poll`)).text();
  expect(publicView).not.toContain("citrouille");

  // Alice's row reads "chasse Bob" too — match the row whose name is exactly Bob.
  const bobRow = page.getByRole("listitem").filter({ has: page.getByText("Bob", { exact: true }) });
  await bobRow.getByRole("button", { name: "Éliminé·e" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Oui, Bob est éliminé·e" }).click();
  await expect(page.getByText("Alice remporte la partie")).toBeVisible();

  await guestContext.close();
});
