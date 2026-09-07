import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReconciliationTab, signOffBlockedReason } from "@/components/admin/migration/reconciliation-tab";
import { ACCOUNT_ID, BATCH_ID, REPORT_ID, aLine, aReport } from "@/redux/migrationApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/migration/x" }));

const OPEN_LINE = aLine({
  kind: "count_by_object",
  subject: "attachments",
  source_figure: 2,
  target_figure: 0,
  delta: -2,
  status: "delta_open",
});

describe("signOffBlockedReason", () => {
  it("words the server's sign_blocker and stays silent when the reader may sign", () => {
    expect(signOffBlockedReason(aReport())).toBeNull();
    expect(signOffBlockedReason(aReport({ can_sign: false, sign_blocker: "report_signed" }))).toBe("Already signed");
    expect(signOffBlockedReason(aReport({ can_sign: false, sign_blocker: "signer_ran_batch" }))).toBe(
      "You ran this batch; a second person must sign",
    );
    expect(signOffBlockedReason(aReport({ can_sign: false, sign_blocker: "delta_open" }))).toBe(
      "A delta is still open",
    );
    expect(signOffBlockedReason(aReport({ can_sign: false, sign_blocker: null }))).toBe("Sign off is not available");
  });
});

describe("ReconciliationTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the account's reports with their lines, highlights open deltas and sends the explanation to the line's route", async () => {
    let explained = false;
    const calls = stubFetch({
      "GET /v1/migration/reconciliation": () =>
        json([
          explained
            ? aReport({
                lines: [
                  ...aReport().lines,
                  {
                    ...OPEN_LINE,
                    status: "delta_explained",
                    explanation: "out of scope",
                    explained_by: "user-2",
                    explained_by_name: "Dev Patel",
                    explained_at: "2026-09-07T10:00:00Z",
                  },
                ],
                version: 2,
              })
            : aReport({ lines: [...aReport().lines, OPEN_LINE], can_sign: false, sign_blocker: "delta_open" }),
        ]),
      [`POST /v1/migration/reconciliation/${REPORT_ID}/lines/3/explain`]: () => {
        explained = true;
        return json(aReport({ version: 2 }), 201);
      },
    });
    renderDesk(<ReconciliationTab accountId={ACCOUNT_ID} batchId={BATCH_ID} />);
    await screen.findByText("attachments");
    expect(calls[0].search).toBe(`?account_id=${ACCOUNT_ID}`);
    expect(screen.getByText("-2")).toHaveAttribute("data-delta", "-2");
    expect(screen.getByText("Delta open")).toHaveAttribute("data-state", "overdue");
    expect(screen.getAllByText("Matched")).toHaveLength(3);
    const signOff = screen.getByRole("button", { name: "Sign off" });
    expect(signOff).toBeDisabled();
    expect(screen.getByText("A delta is still open")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Explain" }));
    const dialog = screen.getByRole("dialog", { name: "Explain the delta on attachments" });
    expect(dialog).toHaveTextContent("Source 2, target 0, delta -2");
    const save = screen.getByRole("button", { name: "Save explanation" });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Explanation"), { target: { value: "out of scope" } });
    fireEvent.click(save);
    await waitFor(() =>
      expect(calls.find((call) => call.key.endsWith("/lines/3/explain"))?.body).toEqual({
        explanation: "out of scope",
        version: 1,
      }),
    );
    await screen.findByText("Delta explained");
    // The explainer is named, never shown as an id prefix.
    expect(document.querySelector("[data-explained-by]")).toHaveTextContent("Dev Patel");
    expect(document.querySelector("[data-explained-by]")).not.toHaveTextContent("user-2");
    await waitFor(() => expect(screen.getByRole("button", { name: "Sign off" })).toBeEnabled());
    expect(screen.queryByText("A delta is still open")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Explain" })).not.toBeInTheDocument();
  });

  it("disables Sign off for the person who ran the batch, with the reason", async () => {
    stubFetch({
      "GET /v1/migration/reconciliation": () => json([aReport({ can_sign: false, sign_blocker: "signer_ran_batch" })]),
    });
    renderDesk(<ReconciliationTab accountId={ACCOUNT_ID} />);
    await screen.findByText("Batch report");
    expect(screen.getByRole("button", { name: "Sign off" })).toBeDisabled();
    expect(screen.getByText("You ran this batch; a second person must sign")).toBeInTheDocument();
  });

  it("surfaces signer_ran_batch and delta_open in the server's words when a stale view is refused on sign-off", async () => {
    let attempt = 0;
    const calls = stubFetch({
      "GET /v1/migration/reconciliation": () => json([aReport()]),
      [`POST /v1/migration/reconciliation/${REPORT_ID}/sign-off`]: () => {
        attempt += 1;
        return attempt === 1 ? json({ code: "signer_ran_batch" }, 403) : json({ code: "delta_open" }, 409);
      },
    });
    renderDesk(<ReconciliationTab accountId={ACCOUNT_ID} />);
    await screen.findByText("Batch report");
    expect(screen.getByRole("link", { name: `batch ${BATCH_ID.slice(0, 8)}` })).toHaveAttribute(
      "href",
      `/admin/migration/${BATCH_ID}`,
    );
    const signOff = screen.getByRole("button", { name: "Sign off" });
    expect(signOff).toBeEnabled();
    fireEvent.click(signOff);
    fireEvent.click(screen.getByRole("button", { name: "Confirm sign off" }));
    await screen.findByText(/cannot sign its report. A second administrator must sign/);
    fireEvent.click(screen.getByRole("button", { name: "Sign off" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm sign off" }));
    await screen.findByText(/must be matched or have an explanation before the report can be signed/);
    expect(calls.filter((call) => call.key.endsWith("/sign-off")).map((call) => call.body)).toEqual([
      { version: 1 },
      { version: 1 },
    ]);
  });

  it("signs off with the report version, then shows the frozen report with the signer's name and no actions", async () => {
    let signed = false;
    const frozen = () =>
      aReport({
        status: "signed_off",
        signed_by: "user-2",
        signed_by_name: "Dev Patel",
        signed_at: "2026-09-07T11:00:00Z",
        can_sign: false,
        sign_blocker: "report_signed",
        version: 2,
      });
    stubFetch({
      "GET /v1/migration/reconciliation": () => json([signed ? frozen() : aReport()]),
      [`POST /v1/migration/reconciliation/${REPORT_ID}/sign-off`]: () => {
        signed = true;
        return json(frozen(), 201);
      },
    });
    renderDesk(<ReconciliationTab accountId={ACCOUNT_ID} />);
    await screen.findByRole("button", { name: "Sign off" });
    fireEvent.click(screen.getByRole("button", { name: "Sign off" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm sign off" }));
    await screen.findByText("Signed off", { selector: "[data-state]" });
    await screen.findByText(/Signed by Dev Patel/);
    expect(screen.queryByText(/user-2/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sign off" })).not.toBeInTheDocument();
    expect(screen.queryByText("Already signed")).not.toBeInTheDocument();
    expect(screen.getByText("The report is frozen and its snapshot stored.")).toBeInTheDocument();
  });

  it("filters the reports by scope", async () => {
    const calls = stubFetch({ "GET /v1/migration/reconciliation": () => json([]) });
    renderDesk(<ReconciliationTab accountId={ACCOUNT_ID} />);
    await screen.findByText(/No reconciliation report on this account yet/);
    fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "delta" } });
    await waitFor(() => expect(calls.at(-1)?.search).toBe(`?account_id=${ACCOUNT_ID}&scope=delta`));
  });
});
