import { expect } from "@playwright/test";
import { text } from "../../src/text/en.js";
import { linkWithPath, waitForEmail } from "./mailpit.js";

export const PASSWORD = "correct-horse-battery-9";

let counter = 0;

/** A unique address at example.com for each test user (DESIGN.md §15.5). */
export function uniqueEmail(prefix = "user") {
  counter += 1;
  const id = `${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`;
  return `e2e-${prefix}-${id}@example.com`;
}

/** Fill the login form and submit it. */
export async function logIn(page, email, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel(text.auth.email).fill(email);
  await page.getByLabel(text.auth.password).fill(password);
  await page.getByRole("button", { name: text.auth.login.submit }).click();
}

/**
 * Sign up through the UI and open the link of the verification email.
 * The link starts a session in the same page.
 */
export async function signUpAndVerify(page, email, password = PASSWORD) {
  await page.goto("/signup");
  await page.getByLabel(text.auth.email).fill(email);
  await page.getByLabel(text.auth.password).fill(password);
  await page.getByRole("button", { name: text.auth.signup.submit }).click();
  await expect(page.getByText(text.auth.signup.sent)).toBeVisible();

  const mail = await waitForEmail(email);
  const link = linkWithPath(mail.text, "/verify-email/");
  await page.goto(new URL(link).pathname);
  await expect(page.getByRole("heading", { name: text.diagrams.title, level: 1 })).toBeVisible();
}
