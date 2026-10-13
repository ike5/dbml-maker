import { expect, test } from "@playwright/test";
import { codeContent, expectSaved, makeDiagram, setSource, TWO_TABLES } from "./helpers/editor.js";
import { signUpAndVerify, uniqueEmail } from "./helpers/users.js";

test("EDT-003 and DGM-003 a saved source stays after a reload", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail("editor"));
  await makeDiagram(page, "Shop");

  await setSource(page, TWO_TABLES);
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
  await expectSaved(page);

  await page.reload();
  await expect(codeContent(page)).toContainText("Ref: posts.user_id > users.id");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);
});

test("EDT-002 a syntax error shows an error mark in the code pane", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail("syntax"));
  await makeDiagram(page, "Broken");

  await setSource(page, "Table users {\nid int [pk");
  await expect(page.locator(".cm-lint-marker-error").first()).toBeVisible();
});
