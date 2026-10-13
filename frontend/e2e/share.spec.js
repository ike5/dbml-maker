import { expect, test } from "@playwright/test";
import { text } from "../src/text/en.js";
import { codeContent, expectSaved, makeDiagram, setSource } from "./helpers/editor.js";
import { signUpAndVerify, uniqueEmail } from "./helpers/users.js";

test("SHR-001 a viewer sees a shared diagram and cannot change it", async ({
  browser,
  page: pageA,
}) => {
  const emailB = uniqueEmail("viewer");
  await signUpAndVerify(pageA, uniqueEmail("owner"));
  await makeDiagram(pageA, "For viewer");
  await setSource(pageA, "Table secret_table {\nid int\n}");
  await expectSaved(pageA);

  await pageA.getByRole("button", { name: text.editor.share }).click();
  const dialog = pageA.getByRole("dialog");
  await dialog.getByLabel(text.shares.emailLabel).fill(emailB);
  await dialog.getByLabel(text.shares.roleLabel).selectOption("viewer");
  await dialog.getByRole("button", { name: text.shares.shareAction, exact: true }).click();
  await expect(dialog.getByText(emailB).first()).toBeVisible();

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await signUpAndVerify(pageB, emailB);

  await pageB.getByRole("tab", { name: text.diagrams.tabShared }).click();
  await pageB.getByRole("link", { name: "For viewer" }).click();
  await expect(pageB.getByText(text.editor.viewerNote)).toBeVisible();
  await expect(codeContent(pageB)).toContainText("secret_table");

  await expect(codeContent(pageB)).toHaveAttribute("contenteditable", "false");
  await codeContent(pageB).click();
  await pageB.keyboard.type("Table intruder {}");
  await expect(codeContent(pageB)).not.toContainText("intruder");
  await contextB.close();
});
