import { expect } from "@playwright/test";
import { text } from "../../src/text/en.js";

/** The editable content of the code pane. */
export const codeContent = (page) => page.locator(".cm-content");

/** Replace the source in the code pane. The full source goes in with one insertText. */
export async function setSource(page, source) {
  await codeContent(page).click();
  await page.keyboard.press("ControlOrMeta+A");
  await page.keyboard.insertText(source);
}

/** Wait for the save state "Saved". */
export async function expectSaved(page) {
  await expect(page.getByLabel(text.editor.saveStatusLabel)).toHaveText(text.editor.statusSaved);
}

/** Make a diagram from the list page, and wait until the editor opens. */
export async function makeDiagram(page, name) {
  await page.goto("/");
  await page.getByRole("button", { name: text.diagrams.newDiagram }).click();
  await page.getByLabel(text.diagrams.nameLabel).fill(name);
  await page.getByRole("button", { name: text.diagrams.make, exact: true }).click();
  await expect(page).toHaveURL(/\/d\//);
  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(codeContent(page)).toBeVisible();
}

export const TWO_TABLES = `Table users {
id int [pk]
}
Table posts {
id int [pk]
user_id int
}
Ref: posts.user_id > users.id`;
