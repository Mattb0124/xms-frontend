import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ExportMenu } from "@/components/tickets/export-menu";
import { DownloadError } from "@/lib/exports/download";
import { renderDesk } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/tickets" }));

const downloadFile = vi.fn();
vi.mock("@/lib/exports/download", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/exports/download")>();
  return { ...actual, downloadFile: (request: unknown) => downloadFile(request) };
});

describe("ExportMenu", () => {
  afterEach(() => downloadFile.mockReset());

  it("offers Excel and CSV, sends the current conditions and account filter, and toasts the row count", async () => {
    downloadFile.mockResolvedValue({ blob: new Blob(), fileName: "tickets-2026-09-07.xlsx", rowCount: 42 });
    renderDesk(<ExportMenu params={{ open: true, priority: ["p1"], account_id: ["acct-1"] }} />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Excel (.xlsx)" }));
    await waitFor(() => expect(screen.getByText("Exported 42 rows")).toBeInTheDocument());
    const request = downloadFile.mock.calls[0][0] as { url: string };
    const search = new URL(`http://x${request.url}`).searchParams;
    expect(search.get("format")).toBe("xlsx");
    expect(search.get("account_id")).toBe("acct-1");
    const decoded = JSON.parse(Buffer.from(search.get("conditions")!, "base64url").toString("utf8"));
    expect(decoded.conditions).toEqual([
      { field: "state", op: "not_in", value: ["closed", "cancelled"] },
      { field: "priority", op: "in", value: ["p1"] },
    ]);
    expect(screen.getByText("tickets-2026-09-07.xlsx")).toBeInTheDocument();
  });

  it("names a rejected filter set", async () => {
    downloadFile.mockRejectedValue(new DownloadError(400, "invalid_conditions"));
    renderDesk(<ExportMenu params={{ open: true }} />);
    fireEvent.click(screen.getByRole("button", { name: "Export" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "CSV" }));
    await waitFor(() => expect(screen.getByText("Export not produced")).toBeInTheDocument());
    expect(screen.getByText("The current filters cannot be exported.")).toBeInTheDocument();
  });
});
