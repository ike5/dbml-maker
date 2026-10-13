import { expect, test } from "@playwright/test";
import { text } from "../src/text/en.js";
import { codeContent } from "./helpers/editor.js";
import { signUpAndVerify, uniqueEmail } from "./helpers/users.js";

const SQL = `CREATE TABLE users (
  id integer PRIMARY KEY,
  name varchar(100)
);
CREATE TABLE posts (
  id integer PRIMARY KEY,
  user_id integer REFERENCES users (id)
);
`;

test("IMX-001 and IMX-003 import SQL, then export SQL", async ({ page }) => {
  await signUpAndVerify(page, uniqueEmail("import"));

  await page.getByRole("button", { name: text.diagrams.importDiagram }).click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByLabel(text.importExport.formatLabel)
    .selectOption({ label: text.importExport.formats.postgres });
  await dialog.getByLabel(text.importExport.fileLabel).setInputFiles({
    name: "shop.sql",
    mimeType: "application/sql",
    buffer: Buffer.from(SQL),
  });
  await expect(dialog.getByLabel(text.importExport.contentLabel)).toHaveValue(/CREATE TABLE/);
  await dialog.getByRole("button", { name: text.importExport.importAction }).click();

  await expect(page).toHaveURL(/\/d\//);
  await expect(codeContent(page)).toContainText("users");
  await expect(codeContent(page)).toContainText("posts");
  await expect(page.locator(".react-flow__node")).toHaveCount(2);

  await page.getByRole("button", { name: text.editor.export }).click();
  const exportDialog = page.getByRole("dialog");
  await exportDialog
    .getByLabel(text.importExport.formatLabel)
    .selectOption({ label: text.importExport.formats.mysql });
  const downloadPromise = page.waitForEvent("download");
  await exportDialog.getByRole("button", { name: text.importExport.exportAction }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.sql$/);

  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  expect(Buffer.concat(chunks).toString("utf8")).toContain("CREATE TABLE");
});
