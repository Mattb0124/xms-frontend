import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountContractsTab } from "@/components/admin/contracts/account-contracts-tab";
import {
  describeRateCardError,
  emptyRateCardDraft,
  RateCardsPanel,
  toRateCardBody,
  validateRateCard,
} from "@/components/admin/contracts/rate-cards";
import { ACCOUNT_ID, CONTRACT_ID, aContract } from "@/redux/ticketsApi.test";
import { aRateCard } from "@/redux/timeApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/admin/accounts/${ACCOUNT_ID}` }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const CARDS = `GET /v1/accounts/${ACCOUNT_ID}/rate-cards`;
const PUT = `PUT /v1/accounts/${ACCOUNT_ID}/rate-cards`;
const CONTRACTS = `GET /v1/accounts/${ACCOUNT_ID}/contracts`;

const accountDefault = () => aRateCard({ id: "rc-acct", account_id: ACCOUNT_ID });
const contractCard = () =>
  aRateCard({
    id: "rc-ct",
    account_id: ACCOUNT_ID,
    contract_id: CONTRACT_ID,
    effective_from: "2026-07-01",
    currency: "EUR",
    note: "Renewal uplift",
    entries: [
      { role: "architect", bill_rate: 220, overage_rate: null },
      { role: "consultant", bill_rate: 160, overage_rate: 210 },
    ],
  });

/** The contract route answers with the contract's own versions first, then the account defaults it falls back to. */
function cardsFor(search: string) {
  return json(search.includes(`contract_id=${CONTRACT_ID}`) ? [contractCard(), accountDefault()] : [accountDefault()]);
}

describe("rate card draft", () => {
  it("validates the date, the currency and the lines, and builds the PUT body with the overage rate only when given", () => {
    const draft = emptyRateCardDraft("USD");
    expect(validateRateCard(draft)).toBe("Choose the effective date.");
    expect(validateRateCard({ ...draft, effectiveFrom: "2026-10-01", currency: "US" })).toBe(
      "Currency is a three-letter code, for example USD.",
    );
    expect(validateRateCard({ ...draft, effectiveFrom: "2026-10-01", lines: [] })).toBe("Add at least one role.");
    expect(validateRateCard({ ...draft, effectiveFrom: "2026-10-01" })).toBe(
      "Bill rate for Consultant must be a number, 0 or more.",
    );
    const ready = {
      ...draft,
      effectiveFrom: "2026-10-01",
      currency: "usd",
      note: " Uplift ",
      lines: [
        { role: "consultant", billRate: "160", overageRate: "210" },
        { role: "architect", billRate: "220", overageRate: "" },
      ],
    };
    expect(validateRateCard(ready)).toBeNull();
    expect(validateRateCard({ ...ready, lines: [{ role: "architect", billRate: "220", overageRate: "abc" }] })).toBe(
      "Overage rate for Architect must be a number, 0 or more, or empty.",
    );
    expect(toRateCardBody(ready, CONTRACT_ID)).toEqual({
      contract_id: CONTRACT_ID,
      effective_from: "2026-10-01",
      currency: "USD",
      note: "Uplift",
      entries: [
        { role: "consultant", bill_rate: 160, overage_rate: 210 },
        { role: "architect", bill_rate: 220 },
      ],
    });
    expect(toRateCardBody({ ...ready, note: "" })).toEqual({
      effective_from: "2026-10-01",
      currency: "USD",
      entries: [
        { role: "consultant", bill_rate: 160, overage_rate: 210 },
        { role: "architect", bill_rate: 220 },
      ],
    });
  });

  it("words the two refusals", () => {
    expect(
      describeRateCardError({ status: 409, data: { code: "rate_card_exists", effective_from: "2026-07-01" } }),
    ).toBe(
      "A version already starts on 2026-07-01. Versions are never edited; choose a later effective date for the change.",
    );
    expect(describeRateCardError({ status: 400, data: { code: "duplicate_role" } })).toBe(
      "Each role can appear once on a version.",
    );
  });
});

describe("RateCardsPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists the account defaults, opens a contract's own versions and offers no New version without contracts:manage", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [CARDS]: () => cardsFor(calls[calls.length - 1].search),
    });
    renderDesk(<RateCardsPanel accountId={ACCOUNT_ID} contracts={[aContract()]} />);
    const defaults = await screen.findByRole("list", { name: "Rate card versions for the account default" });
    expect(within(defaults).getByText("2026-01-01")).toBeInTheDocument();
    expect(within(defaults).getByText("Consultant")).toBeInTheDocument();
    expect(defaults.querySelector('[data-role="consultant"]')).toHaveTextContent("Consultant 150.00 (overage 200.00)");
    expect(calls.filter((call) => call.key === CARDS).map((call) => call.search)).toEqual([""]);

    fireEvent.click(screen.getByRole("button", { name: "Rate cards for CT10001" }));
    const own = await screen.findByRole("list", { name: "Rate card versions for CT10001" });
    expect(calls.filter((call) => call.key === CARDS).map((call) => call.search)).toEqual([
      "",
      `?contract_id=${CONTRACT_ID}`,
    ]);
    // Only the contract's own version lists under the contract; the default it falls back to stays in its own section.
    expect(own.querySelectorAll("[data-rate-card]")).toHaveLength(1);
    expect(own.querySelector("[data-effective-from]")).toHaveTextContent("2026-07-01");
    expect(own).toHaveTextContent("EUR");
    expect(own).toHaveTextContent("Renewal uplift");
    expect(own.querySelector('[data-role="architect"]')).toHaveTextContent("Architect 220.00");
    expect(own.querySelector('[data-role="architect"]')).not.toHaveTextContent("overage");
    expect(screen.queryByRole("button", { name: /New version/ })).not.toBeInTheDocument();
  });

  it("creates a version for a contract through PUT with the exact body, then shows it", async () => {
    let saved = false;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "contracts:manage"]),
      [CARDS]: () => {
        const last = calls[calls.length - 1];
        const own = last.search.includes("contract_id") ? (saved ? [contractCard()] : []) : [];
        return json([...own, accountDefault()]);
      },
      [PUT]: () => {
        saved = true;
        return json(contractCard());
      },
    });
    renderDesk(<RateCardsPanel accountId={ACCOUNT_ID} contracts={[aContract({ currency: "EUR" })]} />);
    fireEvent.click(await screen.findByRole("button", { name: "Rate cards for CT10001" }));
    await screen.findByText(/No rate card of its own/);
    fireEvent.click(screen.getByRole("button", { name: "New version for CT10001" }));
    const form = screen.getByRole("form", { name: "New rate card version for CT10001" });
    expect(within(form).getByLabelText("Currency")).toHaveValue("EUR");
    fireEvent.click(within(form).getByRole("button", { name: "Save version" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Choose the effective date.");
    expect(calls.some((call) => call.key === PUT)).toBe(false);

    fireEvent.change(within(form).getByLabelText("Effective from"), { target: { value: "2026-07-01" } });
    fireEvent.change(within(form).getByLabelText("Note"), { target: { value: "Renewal uplift" } });
    fireEvent.change(within(form).getByLabelText("Role 1"), { target: { value: "architect" } });
    fireEvent.change(within(form).getByLabelText("Bill rate 1"), { target: { value: "220" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add line" }));
    fireEvent.change(within(form).getByLabelText("Role 2"), { target: { value: "consultant" } });
    fireEvent.change(within(form).getByLabelText("Bill rate 2"), { target: { value: "160" } });
    fireEvent.change(within(form).getByLabelText("Overage rate 2"), { target: { value: "210" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save version" }));
    await screen.findByText("CT10001: effective 2026-07-01, 2 roles.");
    expect(calls.find((call) => call.key === PUT)?.body).toEqual({
      contract_id: CONTRACT_ID,
      effective_from: "2026-07-01",
      currency: "EUR",
      note: "Renewal uplift",
      entries: [
        { role: "architect", bill_rate: 220 },
        { role: "consultant", bill_rate: 160, overage_rate: 210 },
      ],
    });
    expect(screen.queryByRole("form", { name: "New rate card version for CT10001" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        within(screen.getByRole("list", { name: "Rate card versions for CT10001" })).getByText("2026-07-01"),
      ).toBeInTheDocument(),
    );
  });

  it("words rate_card_exists and duplicate_role on the account default form and keeps it open", async () => {
    let attempt = 0;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "contracts:manage"]),
      [CARDS]: () => json([accountDefault()]),
      [PUT]: () => {
        attempt += 1;
        return attempt === 1
          ? json({ code: "rate_card_exists", effective_from: "2026-01-01" }, 409)
          : json({ code: "duplicate_role" }, 400);
      },
    });
    renderDesk(<RateCardsPanel accountId={ACCOUNT_ID} contracts={[]} />);
    fireEvent.click(await screen.findByRole("button", { name: "New version for the account default" }));
    const form = screen.getByRole("form", { name: "New rate card version for the account default" });
    fireEvent.change(within(form).getByLabelText("Effective from"), { target: { value: "2026-01-01" } });
    fireEvent.change(within(form).getByLabelText("Bill rate 1"), { target: { value: "150" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save version" }));
    await within(form).findByText(
      "A version already starts on 2026-01-01. Versions are never edited; choose a later effective date for the change.",
    );
    fireEvent.change(within(form).getByLabelText("Effective from"), { target: { value: "2026-02-01" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add line" }));
    fireEvent.change(within(form).getByLabelText("Bill rate 2"), { target: { value: "1" } });
    fireEvent.click(within(form).getByRole("button", { name: "Save version" }));
    await within(form).findByText("Each role can appear once on a version.");
    expect(calls.filter((call) => call.key === PUT).map((call) => call.body)).toEqual([
      { effective_from: "2026-01-01", currency: "USD", entries: [{ role: "consultant", bill_rate: 150 }] },
      {
        effective_from: "2026-02-01",
        currency: "USD",
        entries: [
          { role: "consultant", bill_rate: 150 },
          { role: "consultant", bill_rate: 1 },
        ],
      },
    ]);
    // A refused version reloads nothing.
    expect(calls.filter((call) => call.key === CARDS)).toHaveLength(1);
  });

  it("sits on the Contracts tab under the contracts list", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [CONTRACTS]: () => json([aContract()]),
      [CARDS]: () => json([accountDefault()]),
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    expect(await screen.findByRole("button", { name: "Rate cards for CT10001" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Contracts" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Account default rate cards" })).toBeInTheDocument();
  });
});
