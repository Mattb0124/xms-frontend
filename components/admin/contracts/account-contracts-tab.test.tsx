import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountContractsTab,
  handlingCell,
  validateHandling,
} from "@/components/admin/contracts/account-contracts-tab";
import { ACCOUNT_ID, CONTRACT_ID, aCompTimeContract, aContract, aPremiumContract } from "@/redux/ticketsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/admin/accounts/${ACCOUNT_ID}` }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const LIST = `GET /v1/accounts/${ACCOUNT_ID}/contracts`;
const PATCH = `PATCH /v1/accounts/${ACCOUNT_ID}/contracts/${CONTRACT_ID}`;

describe("contract handling words", () => {
  it("words the list cell and refuses a premium without a usable multiplier", () => {
    expect(handlingCell(aContract())).toBe("None");
    expect(handlingCell(aPremiumContract())).toBe("Premium 1.5x per contract");
    expect(handlingCell(aCompTimeContract())).toBe("Comp time");
    expect(validateHandling("none", "")).toBeNull();
    expect(validateHandling("comp_time", "abc")).toBeNull();
    expect(validateHandling("premium_rate", "")).toBe("Premium rate needs a multiplier, for example 1.5.");
    expect(validateHandling("premium_rate", "0.5")).toBe("The multiplier must be 1 or more.");
    expect(validateHandling("premium_rate", "1.5")).toBeNull();
  });
});

describe("AccountContractsTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without tickets:view and never reads the contracts", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts"]) });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    await screen.findByText(/Needs the tickets:view permission/);
    expect(calls.some((call) => call.key === LIST)).toBe(false);
  });

  it("lists the contracts with their handling and offers no edit without contracts:manage", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "tickets:view"]),
      [LIST]: () =>
        json([
          aContract(),
          aPremiumContract({ id: "c-2", key: "CT10002", name: "Premium block", model: "prepaid_block" }),
          aCompTimeContract({ id: "c-3", key: "CT10003", name: "Comp retainer", status: "draft" }),
        ]),
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    // The key shows in the list and again on its rate cards disclosure.
    await screen.findAllByText("CT10003");
    expect(screen.getByText("None")).toHaveAttribute("data-handling", "none");
    expect(screen.getByText("Premium 1.5x per contract")).toHaveAttribute("data-handling", "premium_rate");
    expect(screen.getByText("Comp time")).toHaveAttribute("data-handling", "comp_time");
    expect(screen.getByText("Prepaid block")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit handling/ })).not.toBeInTheDocument();
  });

  it("saves premium rate with its multiplier and the version through PATCH, then shows the new handling", async () => {
    let saved = false;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "tickets:view", "contracts:manage"]),
      [LIST]: () => json([saved ? aPremiumContract({ version: 2 }) : aContract()]),
      [PATCH]: () => {
        saved = true;
        return json(aPremiumContract({ version: 2 }));
      },
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit handling for CT10001" }));
    const editor = screen.getByLabelText("After-hours handling for CT10001");
    expect(within(editor).queryByLabelText("Multiplier")).not.toBeInTheDocument();
    fireEvent.change(within(editor).getByLabelText("After-hours handling"), { target: { value: "premium_rate" } });
    const multiplier = within(editor).getByLabelText("Multiplier");
    fireEvent.change(multiplier, { target: { value: "0.5" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save handling" }));
    expect(within(editor).getByRole("alert")).toHaveTextContent("The multiplier must be 1 or more.");
    expect(calls.some((call) => call.key === PATCH)).toBe(false);
    fireEvent.change(multiplier, { target: { value: "1.5" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save handling" }));
    await screen.findByText("CT10001: Premium 1.5x per contract.");
    expect(calls.find((call) => call.key === PATCH)?.body).toEqual({
      version: 1,
      after_hours_handling: "premium_rate",
      after_hours_multiplier: 1.5,
    });
    await waitFor(() => expect(screen.getByText("Premium 1.5x per contract")).toBeInTheDocument());
    expect(screen.queryByLabelText("After-hours handling for CT10001")).not.toBeInTheDocument();
  });

  it("sends comp time without a multiplier and words multiplier_required and the stale version", async () => {
    let attempt = 0;
    let reads = 0;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["tickets:view", "contracts:manage"]),
      [LIST]: () => {
        reads += 1;
        return json([aPremiumContract({ version: reads })]);
      },
      [PATCH]: () => {
        attempt += 1;
        if (attempt === 1) return json({ code: "multiplier_required", handling: "premium_rate" }, 400);
        if (attempt === 2) return json({ code: "stale_version" }, 409);
        return json(aCompTimeContract({ version: 3 }));
      },
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit handling for CT10001" }));
    const editor = () => screen.getByLabelText("After-hours handling for CT10001");
    // The editor opens on the contract's current handling with its multiplier.
    expect(within(editor()).getByLabelText("After-hours handling")).toHaveValue("premium_rate");
    expect(within(editor()).getByLabelText("Multiplier")).toHaveValue("1.5");
    fireEvent.click(within(editor()).getByRole("button", { name: "Save handling" }));
    await within(editor()).findByText("Premium rate needs a multiplier, for example 1.5.");
    fireEvent.change(within(editor()).getByLabelText("After-hours handling"), { target: { value: "comp_time" } });
    expect(within(editor()).queryByLabelText("Multiplier")).not.toBeInTheDocument();
    fireEvent.click(within(editor()).getByRole("button", { name: "Save handling" }));
    await screen.findByText("Someone else changed this contract. It has been reloaded.");
    // The stale answer reloads the list; the editor remounts on the new version.
    await waitFor(() => expect(reads).toBe(2));
    await waitFor(() => expect(screen.getByText(/version 2$/)).toBeInTheDocument());
    fireEvent.change(within(editor()).getByLabelText("After-hours handling"), { target: { value: "comp_time" } });
    fireEvent.click(within(editor()).getByRole("button", { name: "Save handling" }));
    await screen.findByText("CT10001: Comp time.");
    expect(calls.filter((call) => call.key === PATCH).map((call) => call.body)).toEqual([
      { version: 1, after_hours_handling: "premium_rate", after_hours_multiplier: 1.5 },
      { version: 1, after_hours_handling: "comp_time" },
      { version: 2, after_hours_handling: "comp_time" },
    ]);
  });
});
