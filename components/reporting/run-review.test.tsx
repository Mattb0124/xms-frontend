import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { formatMoment } from "@/lib/format/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportRunReview } from "@/components/reporting/run-review";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import {
  aDelivery,
  aHeldPack,
  aNarrativeEdit,
  anEditedReviewRun,
  aRegeneratedRun,
  aReviewRun,
  REVIEW_RUN_ID,
} from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({ usePathname: () => `/reports/runs/${REVIEW_RUN_ID}` }));

const RUN = `GET /v1/reporting/runs/${REVIEW_RUN_ID}`;
const NARRATIVE = `PATCH /v1/reporting/runs/${REVIEW_RUN_ID}/narrative`;
const REGENERATE = `POST /v1/reporting/runs/${REVIEW_RUN_ID}/regenerate`;
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
    expect(screen.getByText(`Approve or cancel it before ${formatMoment("2026-09-08T06:00:00Z")}.`)).toBeTruthy();

    // Both renditions are opened through the presigned links the API minted,
    // with no opener and no referrer.
    const pdf = screen.getByRole("link", { name: "Open PDF" });
    expect(pdf.getAttribute("href")).toBe("https://files.example.test/packs/held.pdf?signature=constructed");
    expect(pdf.getAttribute("rel")).toBe("noopener noreferrer");
    expect(screen.getByRole("link", { name: "Open slides" }).getAttribute("href")).toContain("held.pptx");
    // No back link on a record screen: the ticket record dropped its own in
    // pass two, and this one said "Report packs" while going to the account's
    // reports tab, which is a label that lies.
    expect(screen.queryByRole("link", { name: /^←/ })).toBeNull();

    // The numbers are the deck's own sections. The headline is prose alone,
    // so while the run is held it lives in the editable panel above rather
    // than being printed twice.
    for (const title of ["Service levels", "Backlog and notable requests", "Consumption"]) {
      expect(screen.getByRole("region", { name: title })).toBeTruthy();
    }
    expect(screen.queryByRole("region", { name: "Headline" })).toBeNull();
    const narrative = screen.getByRole("region", { name: "Narrative" });
    expect(within(narrative).getByLabelText("Headline")).toHaveValue(
      "Volumes held steady and the consolidation cube incident is the only breach.",
    );
    expect(within(narrative).getByLabelText("Service levels")).toHaveValue("");
    // The source of the words is said, and so is the reason they are templated.
    expect(
      screen.getByText("These words came from the template. AI is off for this account, so Axel wrote nothing here."),
    ).toBeTruthy();
    const notable = screen.getByRole("table", { name: "Notable requests" });
    expect(within(notable).getByText("CS0001204")).toBeTruthy();
    expect(
      within(within(screen.getByTestId("review-tiles")).getByText("Open requests").closest("div")!).getByText("120"),
    ).toBeTruthy();
  });

  it("sends a pack nobody rewrote without changes, and sends no body of its own", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(aReviewRun()),
      [APPROVE]: sent,
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");
    // Nothing has been rewritten, so there are no edits to approve: the
    // button that says so is the one offered.
    expect(screen.getByRole("button", { name: "Approve and send" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Send without changes" }));

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
    fireEvent.click(screen.getByRole("button", { name: "Send without changes" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This run is no longer waiting on a reviewer: it is sent. It has been reloaded.",
    );
    expect(screen.getByRole("region", { name: "Narrative" })).toBeTruthy();
  });

  it("words a run generated by hand and one that stored no pack", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(aReviewRun({ schedule_id: null })),
      [APPROVE]: () => json({ code: "run_without_schedule" }, 409),
    });
    const view = renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");
    fireEvent.click(screen.getByRole("button", { name: "Send without changes" }));
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
    expect(screen.queryByRole("button", { name: "Send without changes" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cancel" })).toBeNull();
    // Nothing is editable once the run is decided: the words are printed with
    // the numbers, as the renditions print them.
    expect(screen.queryByRole("region", { name: "Narrative" })).toBeNull();
    expect(
      within(screen.getByRole("region", { name: "Headline" })).getByText(
        "Volumes held steady and the consolidation cube incident is the only breach.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("The narrative names the wrong client")).toBeTruthy();
    expect(screen.getByText("No recipients on this schedule.")).toBeTruthy();
    // Cancelled reads as cancelled, never as the raw `skipped` the row carries.
    expect(screen.getAllByText("Cancelled").length).toBeGreaterThanOrEqual(1);
  });

  /**
   * The editable narrative panel (functional 5.8). "Regenerate with my edits"
   * is the save and the rebuild in one press, because that is what the phrase
   * means, and the run is read again afterwards so the links on the screen
   * are the ones minted against the files that now exist.
   */
  it("saves the reviewer's words and rebuilds both renditions in one press", async () => {
    let edited = false;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(edited ? anEditedReviewRun({ narrative_rendered: true }) : aReviewRun()),
      [NARRATIVE]: () => {
        edited = true;
        return json(aNarrativeEdit());
      },
      [REGENERATE]: () => json(aRegeneratedRun()),
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");

    const regenerate = () => screen.getByRole("button", { name: "Regenerate with my edits" });
    // Nothing has been typed, so there is nothing to regenerate with.
    expect(regenerate()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Headline"), {
      target: { value: "A quiet week, with one breach on the consolidation cube." },
    });
    expect(regenerate()).toBeEnabled();
    fireEvent.click(regenerate());

    await screen.findByText("Regenerated with your edits");
    // Every section is sent once, in the deck's order, and the numbers are
    // not in the body at all.
    expect(calls.find((call) => call.key === NARRATIVE)?.body).toEqual({
      sections: [
        { key: "headline", text: "A quiet week, with one breach on the consolidation cube." },
        { key: "service_levels", text: "" },
        { key: "backlog", text: "" },
        { key: "consumption", text: "Consumption is tracking to plan." },
      ],
    });
    expect(calls.find((call) => call.key === REGENERATE)?.body).toBeUndefined();
    // The run is read again, so the panel and the links come from the server.
    await waitFor(() => expect(calls.filter((call) => call.key === RUN).length).toBeGreaterThanOrEqual(2));
    await waitFor(() =>
      expect(screen.getByLabelText("Headline")).toHaveValue("A quiet week, with one breach on the consolidation cube."),
    );
  });

  it("offers Approve and send once an edit is saved, and says the edit is not in the files yet", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(anEditedReviewRun()),
      [APPROVE]: sent,
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");

    expect(screen.getByText(/A reviewer rewrote these words\. Version 3\./)).toBeTruthy();
    expect(screen.getByText(/approving rebuilds them first either way/)).toBeTruthy();
    // An edit waiting to be regenerated is still regenerable with no further typing.
    expect(screen.getByRole("button", { name: "Regenerate with my edits" })).toBeEnabled();

    const approve = screen.getByRole("button", { name: "Approve and send" });
    expect(approve).toBeEnabled();
    fireEvent.click(approve);
    await screen.findByText("Report pack sent");
    expect(calls.find((call) => call.key === APPROVE)).toBeTruthy();
  });

  it("words a refusal of the narrative edit and regenerates nothing after it", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(aReviewRun()),
      [NARRATIVE]: () => json({ code: "not_under_review", status: "sent" }, 409),
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");
    // The panel's own box, not the section panel of the same name below it.
    fireEvent.change(
      within(screen.getByRole("region", { name: "Narrative" })).getByLabelText("Backlog and notable requests"),
      {
        target: { value: "The backlog is flat." },
      },
    );
    fireEvent.click(screen.getByRole("button", { name: "Regenerate with my edits" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This run is no longer waiting on a reviewer: it is sent. It has been reloaded.",
    );
    expect(calls.some((call) => call.key === REGENERATE)).toBe(false);
  });

  it("words a narrative sent with the same section twice", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["reports:manage"]),
      [RUN]: () => json(aReviewRun()),
      [NARRATIVE]: () => json({ code: "duplicate_section" }, 400),
    });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByTestId("run-review");
    fireEvent.change(within(screen.getByRole("region", { name: "Narrative" })).getByLabelText("Consumption"), {
      target: { value: "Over plan by a day." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Regenerate with my edits" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/same section twice, so nothing was saved/);
  });

  it("says so when the run cannot be read at all", async () => {
    stubFetch({ "GET /v1/admin/me": me(["reports:manage"]), [RUN]: () => json({ code: "not_found" }, 404) });
    renderDesk(<ReportRunReview runId={REVIEW_RUN_ID} />);
    await screen.findByText("This run is not available");
    expect(screen.getByText(/no longer exists, or the account is not granted to you/)).toBeTruthy();
  });
});
