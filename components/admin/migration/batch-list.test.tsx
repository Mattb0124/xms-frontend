import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BatchList } from "@/components/admin/migration/batch-list";
import { BatchProperties, CountsStrip, LogTab, RunProgress } from "@/components/admin/migration/batch-summary";
import {
  BatchStatusPill,
  DryRunPill,
  LineStatusPill,
  RecordStatusPill,
  ReportStatusPill,
} from "@/components/admin/migration/pills";
import { ACCOUNT_ID, aBatch, aBatchDetail } from "@/redux/migrationApi.test";

describe("migration pills", () => {
  it("puts batch, record, line and report statuses on the signal trios", () => {
    render(
      <>
        <BatchStatusPill status="draft" />
        <BatchStatusPill status="failed" title="HTTP 500 from the instance" />
        <BatchStatusPill status="signed_off" />
        <BatchStatusPill status="superseded" />
        <RecordStatusPill status="unmatched" />
        <RecordStatusPill status="error" />
        <LineStatusPill status="delta_open" />
        <LineStatusPill status="delta_explained" />
        <ReportStatusPill status="open" />
        <DryRunPill dryRun />
      </>,
    );
    expect(screen.getByText("Draft")).toHaveAttribute("data-state", "needs-input");
    expect(screen.getByText("Failed")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("Failed")).toHaveAttribute("title", "HTTP 500 from the instance");
    expect(screen.getByText("Signed off")).toHaveAttribute("data-state", "complete");
    expect(screen.getByText("Superseded")).toHaveAttribute("data-state", "blocked");
    expect(screen.getByText("Unmatched")).toHaveAttribute("data-state", "needs-input");
    expect(screen.getByText("Error")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("Delta open")).toHaveAttribute("data-state", "overdue");
    expect(screen.getByText("Delta explained")).toHaveAttribute("data-state", "ready");
    expect(screen.getByText("Open")).toHaveAttribute("data-state", "ready");
    expect(screen.getByText("Dry run")).toHaveAttribute("data-state", "needs-input");
  });
});

describe("BatchList", () => {
  it("renders one row per batch with the account name, range, status, counts and a link to the record", () => {
    render(
      <BatchList
        accountNames={{ [ACCOUNT_ID]: "Brookfield" }}
        rows={[
          aBatch(),
          aBatch({
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            account_id: "other",
            status: "reconciled",
            dry_run: false,
            counts: { extracted: 3, loaded: 2, updated: 0, skipped: 0, unmatched: 1, errors: 2 },
            started_at: "2026-09-07T10:00:00Z",
            finished_at: "2026-09-07T10:05:00Z",
            run_by: "user-2",
            run_by_name: null,
          }),
        ]}
      />,
    );
    expect(screen.getByText("Brookfield")).toBeInTheDocument();
    // The runner is named, never shown as an id prefix; an unresolved name leaves the cell empty.
    expect(screen.getByText("Cara Lee")).toBeInTheDocument();
    expect(screen.queryByText(/user-/)).not.toBeInTheDocument();
    expect(screen.getByText("other")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "88888888" })).toHaveAttribute(
      "href",
      "/admin/migration/88888888-8888-4888-8888-888888888888",
    );
    expect(screen.getAllByText("2025-01-01 to 2025-12-31")).toHaveLength(2);
    expect(screen.getByText("Reconciled")).toHaveAttribute("data-state", "ready");
    expect(screen.getByText("Real run")).toBeInTheDocument();
    expect(screen.getByText("1")).toHaveAttribute("data-count-tone", "needs-input");
    expect(screen.getAllByText("2").find((node) => node.getAttribute("data-count-tone"))).toHaveAttribute(
      "data-count-tone",
      "overdue",
    );
    expect(screen.getByText("2026-09-07 10:05")).toBeInTheDocument();
  });

  it("shows the spec's empty state", () => {
    render(<BatchList rows={[]} />);
    expect(screen.getByText(/Create the first batch for an account/)).toBeInTheDocument();
  });
});

describe("batch summary", () => {
  it("renders the counts with their tones, the properties and the log", () => {
    const batch = aBatchDetail({
      status: "failed",
      dry_run: false,
      counts: { extracted: 3, loaded: 2, updated: 0, skipped: 1, unmatched: 1, errors: 1 },
      error: "instance unreachable",
      log: [
        { at: "2026-09-07T10:00:00Z", message: "extracted 3 cases from Brookfield CSM" },
        { at: "2026-09-07T10:01:00Z", message: "mapped 3: 2 to load, 0 to update, 1 unchanged, 1 unmatched" },
      ],
      supersedes_batch_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    });
    render(
      <>
        <CountsStrip batch={batch} />
        <BatchProperties batch={batch} accountName="Brookfield" />
        <LogTab batch={batch} />
        <RunProgress batch={batch} />
      </>,
    );
    expect(screen.getByText("Unmatched").nextElementSibling).toHaveAttribute("data-tone", "warn");
    expect(screen.getByText("Errors").nextElementSibling).toHaveAttribute("data-tone", "breach");
    expect(screen.getByText("Loaded").nextElementSibling).toHaveAttribute("data-tone", "good");
    expect(screen.getByRole("link", { name: "Brookfield CSM (sn_customerservice_case)" })).toHaveAttribute(
      "href",
      "/admin/connectors/11111111-1111-4111-8111-111111111111",
    );
    expect(screen.getByRole("link", { name: "cccccccc" })).toHaveAttribute(
      "href",
      "/admin/migration/cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    );
    expect(screen.getByText("field map-1, state map-2")).toBeInTheDocument();
    expect(screen.getByText("Run by").nextElementSibling).toHaveTextContent("Cara Lee");
    expect(screen.getByRole("alert")).toHaveTextContent("instance unreachable");
    expect(screen.getByText("extracted 3 cases from Brookfield CSM")).toBeInTheDocument();
    expect(screen.getByText("Failed: instance unreachable")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows the progress line only while the batch runs", () => {
    render(<RunProgress batch={aBatchDetail({ status: "mapping", checkpoint: { offset: 500, page: 0 } })} />);
    expect(screen.getByRole("status")).toHaveTextContent("Mapping, 500 rows so far");
  });
});
