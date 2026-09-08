import { screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IntegrityPanel } from "@/components/admin/integrity-panel";
import {
  archiveLine,
  bytesLabel,
  chainSummary,
  digestLabel,
  momentLabel,
  retentionLines,
  spanLine,
  verificationLine,
} from "@/lib/reporting/integrity";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";
import { anIntegrityPanel } from "@/test-kit/reporting";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/security" }));

const me = () => ({
  principal: { kind: "internal", userId: "user-ada", accountIds: [], permissions: ["audit:read"] },
});

const panel = () => screen.getByTestId("integrity-panel");

describe("the integrity vocabulary", () => {
  it("does not report a stream that was never verified as a passing one", () => {
    const [audit, security] = anIntegrityPanel().chain!.streams;
    expect(verificationLine(audit)).toEqual({ text: "Matched, 2026-09-07 01:05:00", tone: "good" });
    expect(verificationLine(security)).toEqual({ text: "Never verified", tone: "warn" });
    expect(verificationLine({ ...audit, last_verification_matched: false })).toEqual({
      text: "Did not match, 2026-09-07 01:05:00",
      tone: "breach",
    });
  });

  it("leads with a mismatch when there has ever been one", () => {
    expect(
      chainSummary({
        last_digest_at: "2026-09-07T01:00:00.000Z",
        last_verification_at: "2026-09-07T01:05:00.000Z",
        last_mismatch_at: "2026-08-30T02:00:00.000Z",
      }),
    ).toEqual({ text: "A digest did not match on 2026-08-30 02:00:00", tone: "breach" });
    expect(chainSummary({ last_digest_at: null, last_verification_at: null, last_mismatch_at: null })).toEqual({
      text: "No day has been digested yet",
      tone: "warn",
    });
    expect(
      chainSummary({ last_digest_at: "2026-09-07T01:00:00.000Z", last_verification_at: null, last_mismatch_at: null }),
    ).toMatchObject({ tone: "warn" });
  });

  it("says the retention months are a policy and that the detach job is not built", () => {
    const lines = retentionLines(anIntegrityPanel().retention!);
    expect(lines[0]).toBe("Security events: 24 months in the database.");
    expect(lines[3]).toContain("declared policy, not a measurement");
    expect(lines[3]).toContain("not built yet");
    expect(lines[4]).toBe("Source: Audit & Analytics section 6.");
    expect(retentionLines({ ...anIntegrityPanel().retention!, detach_job_built: true })[3]).toBe(
      "The job that moves older partitions out is running.",
    );
  });

  it("reads bytes, spans, digests and moments the way a person does", () => {
    expect(bytesLabel(900)).toBe("900 B");
    expect(bytesLabel(48_128)).toBe("47 KB");
    expect(bytesLabel(5_242_880)).toBe("5.0 MB");
    expect(archiveLine(anIntegrityPanel().archive!.streams[0])).toBe("3 days, 264 rows, 47 KB");
    expect(spanLine({ stream: "usage", n: 0, oldest: null, newest: null })).toBe("No events");
    expect(spanLine(anIntegrityPanel().streams![1])).toBe("2026-08-01 00:00:00 to 2026-09-07 11:00:00");
    expect(digestLabel("9f2c1d4e5a6b7c8d")).toBe("9f2c1d4e5a6b...");
    expect(momentLabel(null)).toBe("Never");
    expect(momentLabel(null, "no day")).toBe("no day");
    expect(momentLabel("2026-09-06")).toBe("2026-09-06");
  });
});

describe("IntegrityPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names the chain, the archive, the counts and the retention policy", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/security/integrity": () => json(anIntegrityPanel()),
    });
    renderDesk(<IntegrityPanel />);

    await waitFor(() => expect(screen.getByTestId("integrity-panel")).toBeInTheDocument());
    expect(within(panel()).getByText(/no mismatch recorded/)).toBeInTheDocument();
    // The digested day, its row count and the head of the hash.
    expect(within(panel()).getByText(/through 2026-09-06, 412 rows, 9f2c1d4e5a6b/)).toBeInTheDocument();
    expect(within(panel()).getByText("Matched, 2026-09-07 01:05:00")).toBeInTheDocument();
    expect(within(panel()).getByText("Never verified")).toBeInTheDocument();
    expect(within(panel()).getByText(/3 days, 264 rows, 47 KB/)).toBeInTheDocument();
    expect(within(panel()).getByText("1204")).toBeInTheDocument();
    expect(within(panel()).getByText("No events")).toBeInTheDocument();
    expect(within(panel()).getByText(/the job that detaches older partitions is not built yet/)).toBeInTheDocument();
  });

  it("tones a mismatch as a breach so it cannot be read past", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/security/integrity": () =>
        json(
          anIntegrityPanel({
            chain: {
              ...anIntegrityPanel().chain!,
              last_mismatch_at: "2026-08-30T02:00:00.000Z",
            },
          }),
        ),
    });
    renderDesk(<IntegrityPanel />);

    await waitFor(() => expect(screen.getByText(/A digest did not match/)).toBeInTheDocument());
    expect(screen.getByText(/A digest did not match/)).toHaveAttribute("data-tone", "breach");
  });

  it("leaves out a block the API did not answer", async () => {
    stubFetch({
      "GET /v1/admin/me": () => json(me()),
      "GET /v1/dashboards/security/integrity": () => json({ retention: anIntegrityPanel().retention }),
    });
    renderDesk(<IntegrityPanel />);

    await waitFor(() => expect(screen.getByTestId("integrity-panel")).toBeInTheDocument());
    expect(within(panel()).queryByText("Digest chain")).not.toBeInTheDocument();
    expect(within(panel()).queryByText("Archive")).not.toBeInTheDocument();
    expect(within(panel()).getByText("Retention")).toBeInTheDocument();
  });

  it("draws no panel at all where the API does not serve the route", async () => {
    stubFetch({ "GET /v1/admin/me": () => json(me()) });
    renderDesk(<IntegrityPanel />);

    await waitFor(() => expect(screen.queryByTestId("integrity-panel")).not.toBeInTheDocument());
    expect(screen.queryByRole("region", { name: "Integrity" })).not.toBeInTheDocument();
  });
});
