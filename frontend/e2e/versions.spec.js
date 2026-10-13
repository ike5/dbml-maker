import { expect, test } from "@playwright/test";
import { text } from "../src/text/en.js";
import { codeContent, expectSaved, makeDiagram, setSource } from "./helpers/editor.js";
import { signUpAndVerify, uniqueEmail } from "./helpers/users.js";

test("VER-001 and VER-003 restore a named version", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail("versions"));
  await makeDiagram(page, "History");

  await setSource(page, "Table old_table {\nid int\n}");
  await expectSaved(page);

  await page.getByRole("button", { name: text.editor.versions }).click();
  const panel = page.getByRole("complementary");
  await panel.getByLabel(text.versions.labelLabel).fill("First draft");
  await panel.getByRole("button", { name: text.versions.make }).click();
  await expect(panel.getByText(text.versions.made)).toBeVisible();

  await setSource(page, "Table new_table {\nid int\n}");
  await expectSaved(page);
  await expect(codeContent(page)).toContainText("new_table");

  await panel.getByRole("button", { name: "Restore the version First draft" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: text.versions.restore, exact: true })
    .click();

  await expect(codeContent(page)).toContainText("old_table");
  await expect(codeContent(page)).not.toContainText("new_table");
});
