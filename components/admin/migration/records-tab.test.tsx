import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RecordsTab } from "@/components/admin/migration/records-tab";
import { BATCH_ID, RECORD_ID, aRecord } from "@/redux/migrationApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const OTHER = "99999999-9999-4999-8999-999999999998";

describe("RecordsTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the records, sends the status filter and the search to the API, and opens the record drawer", async () => {
    const calls = stubFetch({
      [`GET /v1/migration/batches/${BATCH_ID}/records`]: () =>
        json([
          aRecord(),
          aRecord({
            id: OTHER,
            source_id: "sys-def456",
            source_key: "CS0012346",
            status: "error",
            message: "requester_email unmapped or empty",
          }),
        ]),
      [`GET /v1/migration/batches/${BATCH_ID}/records/${OTHER}`]: () =>
        json({
          ...aRecord({
            id: OTHER,
            source_id: "sys-def456",
            status: "error",
            message: "requester_email unmapped or empty",
          }),
          payload: { record: { sys_id: "sys-def456", short_description: "Missing contact" }, journal: [] },
        }),
    });
    renderDesk(<RecordsTab batchId={BATCH_ID} />);
    await screen.findByText("CS0012345");
    expect(calls[0].search).toBe("");
    expect(screen.getByText("Error", { selector: "[data-state]" })).toHaveAttribute("data-state", "overdue");

    fireEvent.change(screen.getByLabelText("Record status"), { target: { value: "error" } });
    await waitFor(() => expect(calls.at(-1)?.search).toBe("?status=error"));
    fireEvent.change(screen.getByLabelText("Search records"), { target: { value: "CS0012" } });
    fireEvent.submit(screen.getByLabelText("Search records").closest("form")!);
    await waitFor(() => expect(calls.at(-1)?.search).toBe("?status=error&q=CS0012"));

    fireEvent.click(screen.getByText("sys-def456"));
    const drawer = await screen.findByRole("dialog", { name: "Migration record" });
    await waitFor(() => expect(drawer.querySelector("[data-record-message]")).toHaveTextContent("requester_email"));
    expect(drawer.querySelector("[data-payload-key]")).toHaveTextContent(`migration/${BATCH_ID}/raw/sys-abc123.json`);
    expect(drawer).toHaveTextContent('"short_description": "Missing contact"');
    expect(calls.some((call) => call.key === `GET /v1/migration/batches/${BATCH_ID}/records/${OTHER}`)).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(RECORD_ID).not.toBe(OTHER);
  });

  it("links loaded records to their ticket", async () => {
    stubFetch({
      [`GET /v1/migration/batches/${BATCH_ID}/records`]: () =>
        json([
          aRecord({
            status: "loaded",
            target_table: "acct.tickets",
            target_id: "33333333-3333-4333-8333-333333333333",
          }),
        ]),
    });
    renderDesk(<RecordsTab batchId={BATCH_ID} />);
    expect(await screen.findByRole("link", { name: "33333333" })).toHaveAttribute(
      "href",
      "/tickets/33333333-3333-4333-8333-333333333333",
    );
  });
});
