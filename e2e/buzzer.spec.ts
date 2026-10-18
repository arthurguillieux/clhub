import { test, expect } from "@playwright/test";

/**
 * The whole buzzer chain through the real UI: a signed-in member starts a
 * game, a guest with no account joins from the QR code's URL in a separate
 * browser context (so none of the host's cookies leak in), and the first
 * buzz shows up on the host screen. The domain rules (lock-out, eliminations,
 * scoring) are covered exhaustively by unit tests — this only proves the
 * pieces are wired together, including the public-vs-signed-in split.
 */
test("a guest joins a buzzer game without an account and buzzes first", async ({ page, browser, baseURL }) => {
  // Host: any signed-in member can start a game.
  await page.goto("/jeux/buzzer");
  await page.getByRole("button", { name: "Lancer une nouvelle partie" }).click();
  await expect(page).toHaveURL(/\/buzzer\/[A-Z0-9]{6}\/animateur$/);
  const code = page.url().match(/\/buzzer\/([A-Z0-9]{6})\/animateur/)![1]!;
  await expect(page.getByText("En attente des équipes…")).toBeVisible();

  // Guest: a brand-new browser context — no session, no storage. The empty storageState is explicit
  // on purpose: contexts made through `browser.newContext()` inherit the project's signed-in state otherwise.
  const guestContext = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const guest = await guestContext.newPage();

  await guest.goto(`/buzzer/${code}`);
  await guest.getByPlaceholder("Nom de l'équipe").fill("Les Invités");
  await guest.getByRole("button", { name: "Rejoindre" }).click();
  await expect(guest.getByRole("button", { name: "ATTENDS" })).toBeVisible();

  // The host sees the team arrive without reloading, then starts the quiz and opens the buzzers.
  await expect(page.getByText("1 équipe a rejoint !")).toBeVisible();
  await page.getByRole("button", { name: /Lancer le quizz/ }).click();
  await page.getByRole("button", { name: /Ouvrir les buzzers/ }).click();

  // The guest's buzzer wakes up, they buzz, and the host sees who got there first.
  const pad = guest.getByRole("button", { name: "BUZZ !" });
  await expect(pad).toBeVisible();
  await pad.click();
  await expect(guest.getByRole("button", { name: "BUZZÉ !" })).toBeVisible();
  await expect(page.getByText("a buzzé en premier !")).toBeVisible();
  await expect(page.getByText("Les Invités").first()).toBeVisible();

  // A right answer scores the point and closes the round on both screens.
  await page.getByRole("button", { name: /Bonne réponse/ }).click();
  await expect(guest.getByRole("button", { name: "ATTENDS" })).toBeVisible();

  // The host controls stay off-limits to someone who isn't signed in.
  await guest.goto(`/buzzer/${code}/animateur`);
  await expect(guest).toHaveURL(/\/sign-in/);

  // Ending the game tells the phones.
  const guestAgain = await guestContext.newPage();
  await guestAgain.goto(`/buzzer/${code}`);
  await expect(guestAgain.getByRole("button", { name: "ATTENDS" })).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Terminer" }).click();
  await expect(page).toHaveURL(/\/jeux\/buzzer$/);
  await expect(guestAgain.getByText("Partie terminée")).toBeVisible();

  await guestContext.close();
});
