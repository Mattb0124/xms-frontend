import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeadLettersTab, summariseOutcomes } from "@/components/admin/connectors/dead-letters-tab";
import { aDeadLetter, anInstance } from "@/redux/connectorsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => "/admin/connectors/x" }));

const ID = anInstance().id;
const A = "44444444-4444-4444-8444-444444444441";
const B = "44444444-4444-4444-8444-444444444442";

describe("DeadLettersTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists open letters by default, selects rows and replays them with an optional reason", async () => {
    const calls = stubFetch({
      [`GET /v1/connectors/${ID}/dead-letters`]: () =>
        json([aDeadLetter({ id: A }), aDeadLetter({ id: B, error: "HTTP 500" })]),
      [`POST /v1/connectors/${ID}/dead-letters/replay`]: () =>
        json({
          results: [
            { id: A, outcome: "replayed" },
            { id: B, outcome: "already_discarded" },
          ],
        }),
    });
    renderDesk(<DeadLettersTab instanceId={ID} />);
    await screen.findByText("HTTP 500");
    expect(calls[0].search).toBe("?resolution=open");
    fireEvent.click(screen.getByLabelText(`Select ${A}`));
    fireEvent.click(screen.getByLabelText(`Select ${B}`));
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(screen.getByRole("dialog", { name: "Replay 2 dead letters" })).toBeInTheDocument();
    const confirm = screen.getAllByRole("button", { name: "Replay" }).at(-1)!;
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(calls.find((call) => call.key === `POST /v1/connectors/${ID}/dead-letters/replay`)?.body).toEqual({
        ids: [A, B],
      }),
    );
    await screen.findByText("1 replayed, 1 already resolved.");
    expect(screen.queryByText("2 selected")).not.toBeInTheDocument();
  });

  it("requires a reason to discard and sends it with the ids", async () => {
    const calls = stubFetch({
      [`GET /v1/connectors/${ID}/dead-letters`]: () => json([aDeadLetter({ id: A })]),
      [`POST /v1/connectors/${ID}/dead-letters/discard`]: () => json({ results: [{ id: A, outcome: "discarded" }] }),
    });
    renderDesk(<DeadLettersTab instanceId={ID} />);
    await screen.findByText("state map has no inbound mapping for 18");
    fireEvent.click(screen.getByLabelText(`Select ${A}`));
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    const confirm = screen.getAllByRole("button", { name: "Discard" }).at(-1)!;
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Duplicate of CS0001" } });
    expect(confirm).toBeEnabled();
    fireEvent.click(confirm);
    await waitFor(() =>
      expect(calls.find((call) => call.key === `POST /v1/connectors/${ID}/dead-letters/discard`)?.body).toEqual({
        ids: [A],
        reason: "Duplicate of CS0001",
      }),
    );
    await screen.findByText("1 discarded.");
  });

  it("loads the resolved letters only when the section is opened", async () => {
    const calls = stubFetch({
      [`GET /v1/connectors/${ID}/dead-letters`]: () =>
        json([
          aDeadLetter({
            id: A,
            resolution: "discarded",
            resolution_reason: "Duplicate",
            resolved_at: "2026-09-07T10:00:00Z",
          }),
        ]),
    });
    renderDesk(<DeadLettersTab instanceId={ID} />);
    await waitFor(() => expect(calls).toHaveLength(1));
    const details = screen.getByText("Resolved dead letters").closest("details")!;
    details.open = true;
    fireEvent(details, new Event("toggle"));
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].search).toBe("");
    await screen.findByText("Duplicate");
    expect(summariseOutcomes([{ id: "a", outcome: "discarded" }], "discarded")).toBe("1 discarded.");
  });
});
