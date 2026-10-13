import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/api/client.js";
import { text } from "../text/en.js";
import { Button, Dialog, FormError, IconButton, Menu, Tabs, TextField } from "./index.js";

describe("IconButton", () => {
  it("uses label as the accessible name", () => {
    render(<IconButton label="Delete diagram">x</IconButton>);
    expect(screen.getByRole("button", { name: "Delete diagram" })).toBeInTheDocument();
  });
});

describe("TextField", () => {
  it("links the label, the hint, and the error to the input", () => {
    render(<TextField label="Name" hint="A short name." error="Type a name." />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAccessibleDescription("A short name. Type a name.");
    expect(input).toBeInvalid();
  });
});

describe("FormError", () => {
  it("shows the text of the error code", () => {
    const error = new ApiError({ status: 412, code: "diagram_conflict", message: "Server text." });
    render(<FormError error={error} />);
    expect(screen.getByRole("alert")).toHaveTextContent(text.errors.byCode.diagram_conflict);
  });

  it("shows nothing without an error", () => {
    const { container } = render(<FormError error={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

function DialogHarness({ onClose = () => {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open</Button>
      <button type="button">Outside</button>
      {open && (
        <Dialog
          title="Title"
          onClose={() => {
            onClose();
            setOpen(false);
          }}
          footer={<Button>Last</Button>}
        >
          <input aria-label="Field" />
        </Dialog>
      )}
    </>
  );
}

describe("Dialog", () => {
  it("has the dialog role, a title, and the focus inside", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog", { name: "Title" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toContainElement(document.activeElement);
  });

  it("keeps the focus inside with Tab and Shift+Tab", async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i += 1) {
      await user.tab();
      expect(dialog).toContainElement(document.activeElement);
    }
    for (let i = 0; i < 6; i += 1) {
      await user.tab({ shift: true });
      expect(dialog).toContainElement(document.activeElement);
    }
  });

  it("closes with Escape and returns the focus to the opener", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const opener = screen.getByRole("button", { name: "Open" });
    await user.click(opener);
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
});

describe("Menu", () => {
  it("opens, moves with arrows, runs an action, and closes with Escape", async () => {
    const user = userEvent.setup();
    const onRename = vi.fn();
    render(
      <Menu
        label="Actions"
        items={[
          { label: "Rename", onSelect: onRename },
          { label: "Delete", onSelect: () => {}, danger: true },
        ]}
      />,
    );
    const button = screen.getByRole("button", { name: "Actions" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    await user.click(button);
    expect(screen.getByRole("menuitem", { name: "Rename" })).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByRole("menuitem", { name: "Delete" })).toHaveFocus();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(button).toHaveFocus();

    await user.click(button);
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    expect(onRename).toHaveBeenCalledTimes(1);
  });
});

describe("Tabs", () => {
  it("selects the next tab with the arrow keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <Tabs
        label="Sections"
        tabs={[
          { id: "a", label: "First" },
          { id: "b", label: "Second" },
        ]}
        value="a"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("tab", { name: "First" })).toHaveAttribute("aria-selected", "true");
    screen.getByRole("tab", { name: "First" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith("b");
  });
});
