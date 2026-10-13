import { expect, test } from "@playwright/test";
import { text } from "../src/text/en.js";
import { codeContent, expectSaved, makeDiagram, setSource } from "./helpers/editor.js";
import { signUpAndVerify, uniqueEmail } from "./helpers/users.js";

test("DGM-002 a second tab gets the conflict banner and can keep its version", async ({
  context,
  page: pageA,
}) => {
  await signUpAndVerify(pageA, uniqueEmail("conflict"));
  // The editor saves the first layout. Wait for it, or the save of page B would
  // change the number under page A.
  const firstSave = pageA.waitForResponse((r) => r.request().method() === "PATCH" && r.ok());
  await makeDiagram(pageA, "Shared tabs");
  await firstSave;
  await expectSaved(pageA);

  const pageB = await context.newPage();
  await pageB.goto(pageA.url());
  await expect(codeContent(pageB)).toBeVisible();

  await setSource(pageA, "Table from_a {\nid int\n}");
  await expectSaved(pageA);

  await setSource(pageB, "Table from_b {\nid int\n}");
  await expect(pageB.getByRole("button", { name: text.editor.conflictLoad })).toBeVisible();

  await pageB.getByRole("button", { name: text.editor.conflictKeep }).click();
  await expect(pageB.getByRole("button", { name: text.editor.conflictKeep })).toBeHidden();
  await expectSaved(pageB);

  await pageB.getByRole("button", { name: text.editor.versions }).click();
  await expect(pageB.getByText(text.editor.conflictVersionLabel).first()).toBeVisible();
});
