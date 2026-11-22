import { test, expect } from "@playwright/test";
import { Client } from "pg";
import { createTestMember } from "./helpers/db";

const E2E_DB_URL = "postgresql://clhub:clhub@localhost:5432/clhub_e2e";

/**
 * The invitations: a member sees the addresses they invited, who joined (and under which name), sends
 * one again or revokes it (the address can't sign up any more); an address already in the club isn't
 * invited twice; the admin sees everyone's, and by whom, and revokes any.
 */
test("a member follows their invitations, revokes one, and the admin sees who invited whom", async ({ page, browser }) => {
  const stamp = Date.now();
  const waiting = `e2e-invite-${stamp}@example.test`;
  const friend = `e2e-friend-${stamp}@example.test`;
  const byOther = `e2e-other-${stamp}@example.test`;
  // Someone the e2e member invited, who has joined since.
  await createTestMember(`Lou ${stamp}`, friend);
  const db = new Client({ connectionString: E2E_DB_URL });
  await db.connect();
  const me = await db.query(`select m.id from member m join "user" u on u.id = m.user_id where u.email like 'e2e-member1%' limit 1`);
  await db.query("insert into invitation (email, token_hash, invited_by_id, expires_at, accepted_at) values ($1, $2, $3, now() + interval '14 days', now())", [friend, `hash-${stamp}`, me.rows[0].id]);
  // Another member's invitation, still waiting: only the admin may revoke it.
  const { memberId: zed } = await createTestMember(`Zed ${stamp}`, `e2e-zed-${stamp}@example.test`);
  await db.query("insert into invitation (email, token_hash, invited_by_id, expires_at) values ($1, $2, $3, now() + interval '14 days')", [byOther, `hash-other-${stamp}`, zed]);
  await db.end();

  await page.goto("/invite");
  await page.getByLabel("Adresse mail à inviter").fill(waiting);
  await page.getByRole("button", { name: "Inviter" }).click();
  await expect(page.getByText(/invitation envoyée/)).toBeVisible();
  const list = page.getByRole("region", { name: "Tes invitations" });
  const row = list.getByRole("listitem").filter({ hasText: waiting });
  await expect(row).toContainText("en attente");
  await expect(row).toContainText("le lien expire");
  await expect(list.getByRole("listitem").filter({ hasText: friend })).toContainText(`a rejoint le CLHUB`);
  await expect(list.getByRole("listitem").filter({ hasText: friend })).toContainText(`Membre sous le nom de Lou ${stamp}`);
  await expect(list.getByRole("button", { name: `Renvoyer l'invitation à ${friend}` })).toHaveCount(0);
  // Sent a minute ago: not again right away.
  await row.getByRole("button", { name: `Renvoyer l'invitation à ${waiting}` }).click();
  await expect(row.getByText(/vient de partir/)).toBeVisible();

  // Revoked: off the list, and the address can't ask for a sign-in link any more.
  await row.getByRole("button", { name: `Révoquer l'invitation à ${waiting}` }).click();
  await row.getByRole("button", { name: "Révoquer l'invitation", exact: true }).click();
  await expect(page.getByText(`${waiting} n'est plus sur la liste : le lien ne marche plus.`)).toBeVisible();
  await expect(list.getByRole("listitem").filter({ hasText: waiting })).toHaveCount(0, { timeout: 15_000 });
  const outsider = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const signIn = await outsider.newPage();
  await signIn.goto("/sign-in");
  await signIn.getByLabel("Ton adresse mail").fill(waiting);
  await signIn.getByRole("button", { name: "Recevoir mon lien de connexion" }).click();
  await expect(signIn.getByText("T'es pas sur la liste.")).toBeVisible();
  await outsider.close();

  // An address already in the club isn't invited again.
  await page.getByLabel("Adresse mail à inviter").fill(friend);
  await page.getByRole("button", { name: "Inviter" }).click();
  await expect(page.getByText(`${friend} est déjà membre du CLHUB (Lou ${stamp}).`)).toBeVisible();

  // The admin: every invitation, and by whom.
  const admin = new Client({ connectionString: E2E_DB_URL });
  await admin.connect();
  await admin.query("update member set role = 'admin' where id = $1", [me.rows[0].id]);
  await admin.end();
  await page.goto("/");
  const logo = page.getByRole("link", { name: /LE CLHUB/ }).first();
  for (let i = 0; i < 3; i++) await logo.click();
  await page.locator('input[name="code"]').fill("e2e-admin-code");
  await page.getByRole("button", { name: "Entrer" }).click();
  await expect(page.locator('input[name="code"]')).toHaveCount(0, { timeout: 15_000 });
  await page.goto("/admin/membres");
  const all = page.getByRole("region", { name: "Toutes les invitations" });
  await expect(all.getByRole("listitem").filter({ hasText: waiting })).toHaveCount(0); // revoked above
  await expect(all.getByRole("listitem").filter({ hasText: friend })).toContainText("a rejoint le CLHUB");
  await expect(all.getByRole("listitem").filter({ hasText: friend })).toContainText(/Invitée par e2e/i);
  const other = all.getByRole("listitem").filter({ hasText: byOther });
  await expect(other).toContainText(`Invitée par Zed ${stamp}`);
  await other.getByRole("button", { name: `Révoquer l'invitation à ${byOther}` }).click();
  await expect(other).toContainText("Révoquer toutes les invitations");
  await other.getByRole("button", { name: "Révoquer l'invitation", exact: true }).click();
  await expect(page.getByText(`${byOther} n'est plus sur la liste : le lien ne marche plus.`)).toBeVisible();
});
