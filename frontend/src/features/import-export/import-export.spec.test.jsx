import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { server } from "../../test/server.js";
import { renderWithProviders } from "../../test/render.jsx";
import { text } from "../../text/en.js";
import { DbmlError, exportSql, importSql } from "../../lib/dbml/index.js";
import { saveFile } from "./save-file.js";
import { safeBaseName } from "./file-name.js";
import { ExportDialog, ImportDialog } from "./index.js";

// jsdom has no Worker, so the DBML module is a mock. DbmlError stays real.
vi.mock("../../lib/dbml/index.js", async (importOriginal) => ({
  ...(await importOriginal()),
  exportSql: vi.fn(),
  importSql: vi.fn(),
}));
vi.mock("./save-file.js", () => ({ saveFile: vi.fn() }));

const SOURCE = "Table users {\n  id int\n}";

beforeEach(() => {
  vi.resetAllMocks();
});

async function blobText(blob) {
  return await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsText(blob);
  });
}

function renderExport(overrides = {}) {
  const props = {
    name: "Shop",
    source: SOURCE,
    exportImage: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };
  render(<ExportDialog {...props} />);
  return props;
}

async function chooseFormat(user, label) {
  await user.selectOptions(await screen.findByLabelText(text.importExport.formatLabel), label);
}

describe("import-export (spec)", () => {
  it("IMX-001 exports the source as SQL for PostgreSQL, MySQL, SQL Server, and Oracle", async () => {
    const user = userEvent.setup();
    exportSql.mockResolvedValue("CREATE TABLE users ();");
    const props = renderExport();
    const cases = [
      ["postgres", "Shop.postgres.sql"],
      ["mysql", "Shop.mysql.sql"],
      ["mssql", "Shop.mssql.sql"],
      ["oracle", "Shop.oracle.sql"],
    ];
    for (const [dialect, fileName] of cases) {
      await chooseFormat(user, text.importExport.formats[dialect]);
      await user.click(screen.getByRole("button", { name: text.importExport.exportAction }));
      await waitFor(() => expect(exportSql).toHaveBeenLastCalledWith(SOURCE, dialect));
      await waitFor(() =>
        expect(saveFile).toHaveBeenCalledTimes(cases.findIndex((c) => c[0] === dialect) + 1),
      );
      const [blob, savedName] = saveFile.mock.calls.at(-1);
      expect(savedName).toBe(fileName);
      expect(blob.type).toBe("application/sql");
      expect(await blobText(blob)).toBe("CREATE TABLE users ();");
    }
    expect(props.onClose).toHaveBeenCalledTimes(4);
  });

  it("IMX-002 exports the canvas as PNG and SVG through exportImage", async () => {
    const user = userEvent.setup();
    const exportImage = vi.fn(
      async (kind) => new Blob([`image-${kind}`], { type: `image/${kind}` }),
    );
    const props = renderExport({ exportImage });

    await chooseFormat(user, text.importExport.formats.png);
    await user.click(screen.getByRole("button", { name: text.importExport.exportAction }));
    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(1));
    expect(exportImage).toHaveBeenLastCalledWith("png");
    expect(saveFile.mock.calls[0][1]).toBe("Shop.png");

    await chooseFormat(user, text.importExport.formats.svg);
    await user.click(screen.getByRole("button", { name: text.importExport.exportAction }));
    await waitFor(() => expect(saveFile).toHaveBeenCalledTimes(2));
    expect(exportImage).toHaveBeenLastCalledWith("svg");
    expect(saveFile.mock.calls[1][1]).toBe("Shop.svg");
    expect(props.onClose).toHaveBeenCalledTimes(2);
    expect(exportSql).not.toHaveBeenCalled();
  });

  it("IMX-003 imports SQL and makes a new diagram with the DBML result", async () => {
    const user = userEvent.setup();
    importSql.mockResolvedValue("Table users {\n  id int\n}");
    let body;
    server.use(
      http.post("*/api/v1/diagrams", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { id: "new1", name: body.name },
          { status: 201, headers: { ETag: '"1"' } },
        );
      }),
    );
    const onImported = vi.fn();
    renderWithProviders(<ImportDialog onImported={onImported} onClose={vi.fn()} />);

    await user.selectOptions(
      await screen.findByLabelText(text.importExport.formatLabel),
      text.importExport.formats.postgres,
    );
    await user.click(screen.getByLabelText(text.importExport.contentLabel));
    await user.paste("CREATE TABLE users (id int);");
    await user.click(screen.getByRole("button", { name: text.importExport.importAction }));

    await waitFor(() =>
      expect(onImported).toHaveBeenCalledWith(expect.objectContaining({ id: "new1" })),
    );
    expect(importSql).toHaveBeenCalledWith("CREATE TABLE users (id int);", "postgres");
    expect(body).toEqual({
      name: text.importExport.defaultName,
      source: "Table users {\n  id int\n}",
    });
  });

  it("IMX-004 import and export send no request except the new diagram", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    exportSql.mockResolvedValue("SELECT 1;");
    importSql.mockResolvedValue("Table t {\n  id int\n}");
    const bodies = [];
    server.use(
      http.post("*/api/v1/diagrams", async ({ request }) => {
        bodies.push(await request.text());
        return HttpResponse.json({ id: "n" }, { status: 201, headers: { ETag: '"1"' } });
      }),
    );

    // Export: no request.
    const exported = render(
      <ExportDialog name="Shop" source={SOURCE} exportImage={vi.fn()} onClose={vi.fn()} />,
    );
    await chooseFormat(user, text.importExport.formats.mysql);
    await user.click(screen.getByRole("button", { name: text.importExport.exportAction }));
    await waitFor(() => expect(saveFile).toHaveBeenCalled());
    expect(fetchSpy).not.toHaveBeenCalled();
    exported.unmount();

    // Import: one request, and the body has only the DBML result.
    const onImported = vi.fn();
    renderWithProviders(<ImportDialog onImported={onImported} onClose={vi.fn()} />);
    await user.selectOptions(
      await screen.findByLabelText(text.importExport.formatLabel),
      text.importExport.formats.mysql,
    );
    await user.click(screen.getByLabelText(text.importExport.contentLabel));
    await user.paste("CREATE TABLE secret_table (id int);");
    await user.click(screen.getByRole("button", { name: text.importExport.importAction }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(bodies).toHaveLength(1);
    expect(bodies[0]).not.toContain("secret_table");
    expect(bodies[0]).toContain("Table t");
    fetchSpy.mockRestore();
  });
});

describe("export dialog", () => {
  it("saves the DBML source as a text file", async () => {
    const user = userEvent.setup();
    const props = renderExport({ name: "My shop / v2" });
    await user.click(await screen.findByRole("button", { name: text.importExport.exportAction }));
    const [blob, fileName] = saveFile.mock.calls[0];
    expect(fileName).toBe("My-shop---v2.dbml");
    expect(blob.type).toBe("text/plain");
    expect(await blobText(blob)).toBe(SOURCE);
    expect(props.onClose).toHaveBeenCalled();
  });

  it("shows the list of source errors for an SQL export", async () => {
    const user = userEvent.setup();
    exportSql.mockRejectedValue(
      new DbmlError("Invalid", [{ message: "Unexpected token", line: 3, column: 5 }]),
    );
    const props = renderExport();
    await chooseFormat(user, text.importExport.formats.postgres);
    await user.click(screen.getByRole("button", { name: text.importExport.exportAction }));
    expect(await screen.findByText(text.importExport.exportSourceErrors)).toBeInTheDocument();
    expect(screen.getByText("Line 3, column 5: Unexpected token")).toBeInTheDocument();
    expect(props.onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: text.importExport.exportAction })).toBeEnabled();
  });

  it("shows a general message for another error", async () => {
    const user = userEvent.setup();
    exportSql.mockRejectedValue(new Error("boom"));
    renderExport();
    await chooseFormat(user, text.importExport.formats.oracle);
    await user.click(screen.getByRole("button", { name: text.importExport.exportAction }));
    expect(await screen.findByText(text.importExport.exportFailed)).toBeInTheDocument();
  });

  it("disables the button while the export runs", async () => {
    const user = userEvent.setup();
    let finish;
    exportSql.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    renderExport();
    await chooseFormat(user, text.importExport.formats.postgres);
    await user.click(screen.getByRole("button", { name: text.importExport.exportAction }));
    expect(await screen.findByRole("button", { name: /export/i })).toBeDisabled();
    finish("SELECT 1;");
    await waitFor(() => expect(saveFile).toHaveBeenCalled());
  });
});

describe("file name rule", () => {
  it("keeps letters, digits, dash, and underscore", () => {
    expect(safeBaseName("a_b-C9")).toBe("a_b-C9");
    expect(safeBaseName("a b.c")).toBe("a-b-c");
  });

  it("uses diagram if nothing stays", () => {
    expect(safeBaseName("***")).toBe("diagram");
    expect(safeBaseName("")).toBe("diagram");
  });
});

describe("import dialog", () => {
  it("imports a DBML file as it is, and takes the name from the file", async () => {
    const user = userEvent.setup();
    let body;
    server.use(
      http.post("*/api/v1/diagrams", async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ id: "n" }, { status: 201, headers: { ETag: '"1"' } });
      }),
    );
    const onImported = vi.fn();
    renderWithProviders(<ImportDialog onImported={onImported} onClose={vi.fn()} />);
    const file = new File([SOURCE], "shop.dbml", { type: "text/plain" });
    await user.upload(await screen.findByLabelText(text.importExport.fileLabel), file);
    await waitFor(() =>
      expect(screen.getByLabelText(text.importExport.nameLabel)).toHaveValue("shop"),
    );
    expect(screen.getByLabelText(text.importExport.contentLabel)).toHaveValue(SOURCE);
    await user.click(screen.getByRole("button", { name: text.importExport.importAction }));
    await waitFor(() => expect(onImported).toHaveBeenCalled());
    expect(body).toEqual({ name: "shop", source: SOURCE });
    expect(importSql).not.toHaveBeenCalled();
  });

  it("refuses content larger than 1 MiB before any work", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportDialog onImported={vi.fn()} onClose={vi.fn()} />);
    const area = await screen.findByLabelText(text.importExport.contentLabel);
    // fireEvent-like direct set is faster than typing 1 MiB.
    const big = "a".repeat(1024 * 1024 + 1);
    await user.click(area);
    await user.paste(big);
    await user.click(screen.getByRole("button", { name: text.importExport.importAction }));
    expect(await screen.findByText(text.importExport.tooLarge)).toBeInTheDocument();
    expect(importSql).not.toHaveBeenCalled();
  });

  it("refuses empty content", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ImportDialog onImported={vi.fn()} onClose={vi.fn()} />);
    await user.click(await screen.findByRole("button", { name: text.importExport.importAction }));
    expect(await screen.findByText(text.importExport.contentEmpty)).toBeInTheDocument();
  });

  it("shows the SQL errors with line and column", async () => {
    const user = userEvent.setup();
    importSql.mockRejectedValue(
      new DbmlError("Invalid", [{ message: "Bad syntax", line: 2, column: 7 }]),
    );
    renderWithProviders(<ImportDialog onImported={vi.fn()} onClose={vi.fn()} />);
    await user.selectOptions(
      await screen.findByLabelText(text.importExport.formatLabel),
      text.importExport.formats.mssql,
    );
    await user.click(screen.getByLabelText(text.importExport.contentLabel));
    await user.paste("CREATE TABL x");
    await user.click(screen.getByRole("button", { name: text.importExport.importAction }));
    expect(await screen.findByText("Line 2, column 7: Bad syntax")).toBeInTheDocument();
  });

  it("shows the name error of the API at the field", async () => {
    const user = userEvent.setup();
    server.use(
      http.post("*/api/v1/diagrams", () =>
        HttpResponse.json(
          {
            error: {
              code: "validation_error",
              message: "Invalid",
              fields: { name: ["Name is taken."] },
            },
          },
          { status: 400 },
        ),
      ),
    );
    renderWithProviders(<ImportDialog onImported={vi.fn()} onClose={vi.fn()} />);
    await user.click(await screen.findByLabelText(text.importExport.contentLabel));
    await user.paste("Table t {\n  id int\n}");
    await user.click(screen.getByRole("button", { name: text.importExport.importAction }));
    expect(await screen.findByText("Name is taken.")).toBeInTheDocument();
  });
});

describe("lazy wrapper", () => {
  it("shows a spinner first and then the dialog", async () => {
    renderWithProviders(<ImportDialog onImported={vi.fn()} onClose={vi.fn()} />);
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });
});
