import { expect, test } from "@playwright/test";
import { text } from "../src/text/en.js";
import { expectSaved, makeDiagram, setSource, TWO_TABLES } from "./helpers/editor.js";
import { signUpAndVerify, uniqueEmail } from "./helpers/users.js";

async function expectNotFound(page, url) {
  await page.goto(url);
  await expect(page.getByRole("heading", { name: text.editor.publicNotFoundTitle })).toBeVisible();
}

test("SHR-002 to SHR-004 a public link opens, rotates, and turns off", async ({
  browser,
  page,
}) => {
  await signUpAndVerify(page, uniqueEmail("public"));
  await makeDiagram(page, "Open diagram");
  await setSource(page, TWO_TABLES);
  await expectSaved(page);

  await page.getByRole("button", { name: text.editor.share }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: text.shares.linkTurnOn }).click();
  const field = dialog.getByRole("textbox", { name: text.shares.linkLabel });
  await expect(field).toBeVisible();
  const oldUrl = await field.inputValue();
  expect(oldUrl).toContain("/s/");

  const anonymous = await browser.newContext();
  const anonPage = await anonymous.newPage();
  await anonPage.goto(oldUrl);
  await expect(anonPage.getByRole("heading", { name: "Open diagram" })).toBeVisible();
  await expect(anonPage.locator(".react-flow__node")).toHaveCount(2);

  await dialog.getByRole("button", { name: text.shares.linkRotate }).click();
  await dialog.getByRole("button", { name: text.shares.linkRotateConfirm }).click();
  await expect(field).not.toHaveValue(oldUrl);
  const newUrl = await field.inputValue();

  await expectNotFound(anonPage, oldUrl);
  await anonPage.goto(newUrl);
  await expect(anonPage.getByRole("heading", { name: "Open diagram" })).toBeVisible();

  await dialog.getByRole("button", { name: text.shares.linkTurnOff }).click();
  await expect(dialog.getByRole("button", { name: text.shares.linkTurnOn })).toBeVisible();
  await expectNotFound(anonPage, newUrl);
  await anonymous.close();
});
