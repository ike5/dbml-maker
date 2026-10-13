import { expect, test } from "@playwright/test";
import { text } from "../src/text/en.js";
import { logIn, signUpAndVerify, uniqueEmail } from "./helpers/users.js";

test("AUTH-001 sign up, verify, log out, and log in again", async ({ page }) => {
  const email = uniqueEmail("auth");
  await signUpAndVerify(page, email);

  await page.getByRole("button", { name: text.app.logout }).click();
  await expect(page.getByRole("heading", { name: text.auth.login.title })).toBeVisible();

  await logIn(page, email);
  await expect(page.getByRole("heading", { name: text.diagrams.title, level: 1 })).toBeVisible();
  await expect(page.getByText(text.diagrams.emptyMine)).toBeVisible();
});
