import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportRunReview } from "@/components/reporting/run-review";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { aDelivery, aHeldPack, aReviewRun, REVIEW_RUN_ID } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({ usePathname: () => `/reports/runs/${REVIEW_RUN_ID}` }));

const RUN = `GET /v1/reporting/runs/${REVIEW_RUN_ID}`;
const APPROVE = `POST /v1/reporting/runs/${REVIEW_RUN_ID}/approve`;
const CANCEL = `POST /v1/reporting/runs/${REVIEW_RUN_ID}/cancel`;

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: ["acct-1"], permissions } });

const sent = () =>
  json(
    {
      run_id: REVIEW_RUN_ID,
      pack_id: aHeldPack().id,
      period: { start: "2026-08-31", end: "2026-09-06" },
      delivery: [aDelivery(), aDelivery({ kind: "contact", to: "pat@client.test", outcome: "emailed" })],
      status: "sent",
      review_due_at: null,
    },
    201,
  );

describe("ReportRunReview", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("shows the status, the deadline and the pack as the renditions present it", async () => {
    stubFetch({ "GET /v1/admin/me": me(["reports:manage", "admin:accounts"]), [RUN]: () => json(aReviewRun()) });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);

    const view = await screen.findByTestId("run-review");
    expect(view.getAttribute("data-status")).toBe("ready_for_review");
    expect(screen.getByText("2026-08-31 to 2026-09-06")).toBeTruthy();
    // The status pill and the review pill both say where the run stands.
    expect(screen.getAllByText("Ready for review").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Approve or cancel it before 2026-09-08 06:00.")).toBeTruthy();

    // Both renditions are opened through the presigned links the API minted,
    // with no opener and no referrer.
    const pdf = screen.getByRole("link", { name: "Open PDF" });
    expect(pdf.getAttribute("href")).toBe("https://files.example.test/packs/held.pdf?signature=constructed");
    expect(pdf.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: "Open slides" }).getAttribute("href")).toContain("held.pptx");
    expect(screen.getByRole("link", { name: "← Report packs" }).getAttribute("href")).toBe(
      "/admin/accounts/acct-1?tab=reports",
    );

    // The sections are the deck's own, the narrative is the latest version,
    // and it is said to be read only rather than shown as an editable panel.
    for (const title of ["Headline", "Service levels", "Backlog and notable requests", "Consumption"]) {
      expect(screen.getByRole("region", { name: title })).toBeTruthy();
    }
    expect(
      screen.getByText("Volumes held steady and the consolidation cube incident is the only breach this week."),
    ).toBeTruthy();
    expect(screen.getByText(/cannot be edited or regenerated here yet/)).toBeTruthy();
    const notable = screen.getByRole("table", { name: "Notable requests" });
    expect(within(notable).getByText("CS0001204")).toBeTruthy();
    expect(
      within(within(screen.getByTestId("review-tiles")).getByText("Open requests").closest("div")!).getByText("120"),
    ).toBeTruthy();
  });

  it("approves the held run and sends no body of its own", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(aReviewRun()),
      [APPROVE]: sent,
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");
    fireEvent.click(screen.getByRole("button", { name: "Approve and send" }));

    await screen.findByText("Report pack sent");
    const approve = calls.find((call) => call.key === APPROVE);
    expect(approve).toBeTruthy();
    expect(approve?.body).toBeUndefined();
    // The decision reloads the run, so the screen reads the status the server
    // now holds rather than the one it drew the buttons on.
    await waitFor(() => expect(calls.filter((call) => call.key === RUN).length).toBeGreaterThanOrEqual(2));
  });

  it("refuses a cancel with no reason before asking the API, then sends the reason", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(aReviewRun()),
      [CANCEL]: () => json({ run_id: REVIEW_RUN_ID, status: "skipped", reason: "Wrong client named" }, 201),
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    const form = await screen.findByRole("form", { name: "Cancel this run" });
    fireEvent.click(within(form).getByRole("button", { name: "Cancel this run" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Say why this pack is not being sent.");
    expect(calls.some((call) => call.key === CANCEL)).toBe(false);

    fireEvent.change(within(form).getByLabelText("Reason"), { target: { value: " Wrong client named " } });
    fireEvent.click(within(form).getByRole("button", { name: "Cancel this run" }));
    await screen.findByText("Report pack cancelled");
    expect(calls.find((call) => call.key === CANCEL)?.body).toEqual({ reason: "Wrong client named" });
  });

  it("words a run that is no longer under review and keeps the pack readable", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(aReviewRun()),
      [APPROVE]: () => json({ code: "not_under_review", status: "sent" }, 409),
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");
    fireEvent.click(screen.getByRole("button", { name: "Approve and send" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This run is no longer waiting on a reviewer: it is sent. It has been reloaded.",
    );
    expect(screen.getByRole("region", { name: "Headline" })).toBeTruthy();
  });

  it("words a run generated by hand and one that stored no pack", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(aReviewRun({ schedule_id: null })),
      [APPROVE]: () => json({ code: "run_without_schedule" }, 409),
    });
    const view = renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");
    fireEvent.click(screen.getByRole("button", { name: "Approve and send" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This run was generated by hand, so it has no schedule and no recipients to send to.",
    );
    view.unmount();

    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(aReviewRun({ pack: null, pack_id: null, files: { pptx: null, pdf: null } })),
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByText(/stored no pack, so there is nothing to read/);
    // With no rendition stored there is no link to offer either.
    expect(screen.queryByRole("link", { name: "Open PDF" })).toBeNull();
  });

  it("offers no decision on a run that has already been decided, and shows what went out", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () =>
        json(
          aReviewRun({
            status: "skipped",
            review_due_at: null,
            reviewed_at: "2026-09-07T09:00:00Z",
            reviewer_id: "u1",
            review_note: "The narrative names the wrong client",
            delivery: [],
          }),
        ),
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");

    expect(screen.getByText("This run is no longer waiting on a reviewer.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Approve and send" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    expect(screen.getByText("The narrative names the wrong client")).toBeTruthy();
    expect(screen.getByText("No recipients on this schedule.")).toBeTruthy();
    // Cancelled reads as cancelled, never as the raw `skipped` the row carries.
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThanOrEqual(1);
  });

  it("says so when the run cannot be read at all", async () => {
    stubFetch({ "GET /v1/admin/me": me(["reports:manage"]), [RUN]: () => json({ code: "not_found" }, 404) });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByText("This run is not available");
    expect(screen.getByText(/no longer exists, or the account is not granted to you/)).toBeTruthy();
  });
});
