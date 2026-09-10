import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PersonalizeColumns } from "@/components/xms/personalize-columns";
import { DISPLAY_DEFAULTS } from "@/lib/tables/arrangement";

const CHOICES = [
  { key: "key", title: "Number" },
  { key: "state", title: "State" },
  { key: "priority", title: "Priority" },
  { key: "sla", title: "SLA" },
];

function open(overrides: Partial<Parameters<typeof PersonalizeColumns>[0]> = {}) {
  const onSave = vi.fn();
  const onReset = vi.fn();
  const onClose = vi.fn();
  render(
    <PersonalizeColumns
      choices={CHOICES}
      selection={["key", "state", "priority"]}
      defaults={["key", "state", "priority"]}
      options={DISPLAY_DEFAULTS}
      onSave={onSave}
      onReset={onReset}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { onSave, onReset, onClose };
}

function pick(listName: string, ...titles: string[]) {
  const list = screen.getByRole("listbox", { name: listName });
  titles.forEach((title, index) => {
    // The first click picks; the rest add, the way the platform modifier does.
    fireEvent.click(within(list).getByText(title), index === 0 ? {} : { ctrlKey: true });
  });
  return list;
}

/** The titles a list is showing, in order. */
function titlesOf(listName: string): string[] {
  return within(screen.getByRole("listbox", { name: listName }))
    .getAllByRole("option")
    .map((row) => row.textContent ?? "");
}

describe("PersonalizeColumns", () => {
  it("offers what the list does not draw on the left and what it draws on the right", () => {
    open();
    expect(titlesOf("Available")).toEqual(["SLA"]);
    expect(titlesOf("Selected")).toEqual(["Number", "State", "Priority"]);
  });

  it("brings a column across and saves it at the end of the order", () => {
    const { onSave } = open();
    pick("Available", "SLA");
    fireEvent.click(screen.getByLabelText("Add the chosen columns to the list"));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onSave).toHaveBeenCalledWith(["key", "state", "priority", "sla"], DISPLAY_DEFAULTS);
  });

  it("takes a column off the list", () => {
    const { onSave } = open();
    pick("Selected", "State");
    fireEvent.click(screen.getByLabelText("Take the chosen columns off the list"));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onSave).toHaveBeenCalledWith(["key", "priority"], DISPLAY_DEFAULTS);
  });

  it("keeps the last column, because a list with no columns is not a list", () => {
    const { onSave } = open({ selection: ["key"], defaults: ["key"] });
    pick("Selected", "Number");
    fireEvent.click(screen.getByLabelText("Take the chosen columns off the list"));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onSave).toHaveBeenCalledWith(["key"], DISPLAY_DEFAULTS);
  });

  it("moves one column up the order", () => {
    const { onSave } = open();
    pick("Selected", "Priority");
    fireEvent.click(screen.getByLabelText("Move the chosen column up"));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onSave).toHaveBeenCalledWith(["key", "priority", "state"], DISPLAY_DEFAULTS);
  });

  it("saves the display switches beside the columns", () => {
    const { onSave } = open();
    fireEvent.click(screen.getByLabelText("Wrap column text"));
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    expect(onSave).toHaveBeenCalledWith(["key", "state", "priority"], { ...DISPLAY_DEFAULTS, wrap: true });
  });

  it("leaves the list alone on Cancel", () => {
    const { onSave, onClose } = open();
    pick("Selected", "State");
    fireEvent.click(screen.getByLabelText("Take the chosen columns off the list"));
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it("offers Reset only once the order has moved off the screen's own", () => {
    const { onReset } = open();
    const reset = screen.getByRole("button", { name: "Reset to column defaults" });
    expect(reset).toBeDisabled();
    pick("Available", "SLA");
    fireEvent.click(screen.getByLabelText("Add the chosen columns to the list"));
    fireEvent.click(reset);
    expect(onReset).toHaveBeenCalled();
  });

  it("closes on Escape", () => {
    const { onClose } = open();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("does not offer the two switches that would edit a case from the list", () => {
    open();
    const dialogue = within(screen.getByRole("dialog"));
    expect(dialogue.queryByLabelText("Enable list edit")).toBeNull();
    expect(dialogue.queryByLabelText("Double click to edit")).toBeNull();
  });
});
