import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AccountContractsTab,
  draftFromContract,
  handlingCell,
  parseTechnologyCodes,
  parseThresholds,
  rulesBody,
  rulesCell,
  validateHandling,
  validateRules,
} from "@/components/admin/contracts/account-contracts-tab";
import {
  ACCOUNT_ID,
  CONTRACT_ID,
  ENGAGEMENT_ID,
  aCompTimeContract,
  aContract,
  aPremiumContract,
  anEngagement,
} from "@/test-kit/tickets";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/admin/accounts/${ACCOUNT_ID}` }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const LIST = `GET /v1/accounts/${ACCOUNT_ID}/contracts`;
const PATCH = `PATCH /v1/accounts/${ACCOUNT_ID}/contracts/${CONTRACT_ID}`;
const CARDS = `GET /v1/accounts/${ACCOUNT_ID}/rate-cards`;
const ENGAGEMENTS = `GET /v1/accounts/${ACCOUNT_ID}/engagements`;

/** The column-default rules as the PATCH carries them (no multiplier, no cap, filed under nothing). */
const DEFAULT_RULES = {
  engagement_id: null,
  threshold_percents: [50, 75, 90, 100],
  threshold_notify_client: false,
  overage_rule: "allow_flag",
  rollover_rule: "none",
  forecast_window_days: 10,
  technology_codes: [],
};

describe("contract rule words", () => {
  it("words the list cells and refuses a premium without a usable multiplier", () => {
    expect(handlingCell(aContract())).toBe("None");
    expect(handlingCell(aPremiumContract())).toBe("Premium 1.5x per contract");
    expect(handlingCell(aCompTimeContract())).toBe("Comp time");
    expect(rulesCell(aContract())).toBe("Overage allowed with flag; no rollover; thresholds 50, 75, 90, 100%");
    expect(
      rulesCell(
        aContract({
          overage_rule: "allow_rate",
          overage_multiplier: "1.250",
          rollover_rule: "cap",
          rollover_cap_hours: "20.00",
          threshold_percents: [],
        }),
      ),
    ).toBe("Overage at 1.25x; carries to term, capped at 20 h; no thresholds");
    expect(validateHandling("none", "")).toBeNull();
    expect(validateHandling("comp_time", "abc")).toBeNull();
    expect(validateHandling("premium_rate", "")).toBe("Premium rate needs a multiplier, for example 1.5.");
    expect(validateHandling("premium_rate", "0.5")).toBe("The multiplier must be 1 or more.");
    expect(validateHandling("premium_rate", "1.5")).toBeNull();
  });

  it("parses the threshold list and validates the rule set", () => {
    expect(parseThresholds("50, 75, 90, 100")).toEqual([50, 75, 90, 100]);
    expect(parseThresholds("100,50,50")).toEqual([50, 100]);
    expect(parseThresholds("")).toEqual([]);
    expect(parseThresholds("50, abc")).toBeNull();
    expect(parseThresholds("0")).toBeNull();
    expect(parseThresholds("1001")).toBeNull();
    expect(parseThresholds("1,2,3,4,5,6,7,8,9,10,11")).toBeNull();
    const draft = draftFromContract(aContract());
    expect(draft).toEqual({
      engagementId: "",
      handling: "none",
      multiplier: "1.5",
      overageRule: "allow_flag",
      overageMultiplier: "1.25",
      rolloverRule: "none",
      capHours: "",
      thresholds: "50, 75, 90, 100",
      notifyClient: false,
      forecastWindow: "10",
      technologies: "",
    });
    expect(draftFromContract(aContract({ technology_codes: ["onestream", "sap"] })).technologies).toBe(
      "onestream, sap",
    );
    expect(validateRules(draft)).toBeNull();
    expect(validateRules({ ...draft, technologies: "OneStream, bad code" })).toMatch(
      /^Technology codes are lower-case/,
    );
    expect(validateRules({ ...draft, thresholds: "50, x" })).toMatch(/^Thresholds are whole percentages/);
    expect(validateRules({ ...draft, overageRule: "allow_rate", overageMultiplier: "" })).toBe(
      "Allow at overage rate needs a multiplier, for example 1.25.",
    );
    expect(validateRules({ ...draft, overageRule: "allow_rate", overageMultiplier: "0.9" })).toBe(
      "The overage multiplier must be 1 or more.",
    );
    expect(validateRules({ ...draft, rolloverRule: "cap", capHours: "" })).toBe(
      "Cap needs the carried hours limit, for example 20.",
    );
    expect(validateRules({ ...draft, forecastWindow: "0" })).toBe(
      "The forecast window is a whole number of business days from 1 to 90.",
    );
    expect(validateRules({ ...draft, forecastWindow: "91" })).toMatch(/from 1 to 90/);
  });

  it("parses the technology codes as a lower-case list without repeats", () => {
    expect(parseTechnologyCodes("")).toEqual([]);
    expect(parseTechnologyCodes("OneStream, anaplan, onestream ,sap.s4")).toEqual(["onestream", "anaplan", "sap.s4"]);
    expect(parseTechnologyCodes("one stream")).toBeNull();
    expect(parseTechnologyCodes("-bad")).toBeNull();
    expect(parseTechnologyCodes(Array.from({ length: 51 }, (_, index) => `t${index}`).join(","))).toBeNull();
  });

  it("builds the PATCH body with the multiplier and the cap only under their rules", () => {
    const draft = draftFromContract(aContract());
    expect(rulesBody(3, draft)).toEqual({ version: 3, after_hours_handling: "none", ...DEFAULT_RULES });
    expect(
      rulesBody(3, {
        ...draft,
        handling: "premium_rate",
        multiplier: "1.5",
        overageRule: "allow_rate",
        overageMultiplier: "1.25",
        rolloverRule: "cap",
        capHours: "20",
        thresholds: "80, 100",
        notifyClient: true,
        forecastWindow: "5",
        technologies: "OneStream, anaplan",
        engagementId: ENGAGEMENT_ID,
      }),
    ).toEqual({
      version: 3,
      engagement_id: ENGAGEMENT_ID,
      after_hours_handling: "premium_rate",
      after_hours_multiplier: 1.5,
      threshold_percents: [80, 100],
      threshold_notify_client: true,
      overage_rule: "allow_rate",
      overage_multiplier: 1.25,
      rollover_rule: "cap",
      rollover_cap_hours: 20,
      forecast_window_days: 5,
      technology_codes: ["onestream", "anaplan"],
    });
    // Switching away from the rule drops its number even when the field still holds one.
    expect(
      rulesBody(3, {
        ...draft,
        overageRule: "block",
        overageMultiplier: "1.25",
        rolloverRule: "carry_term",
        capHours: "20",
      }),
    ).toEqual({
      version: 3,
      after_hours_handling: "none",
      ...DEFAULT_RULES,
      overage_rule: "block",
      rollover_rule: "carry_term",
    });
    // An emptied picker files the contract under nothing, and says so with an
    // explicit null: undefined would read as "leave the engagement alone".
    expect(rulesBody(3, { ...draft, engagementId: "" }).engagement_id).toBeNull();
    expect(draftFromContract(aContract({ engagement_id: ENGAGEMENT_ID })).engagementId).toBe(ENGAGEMENT_ID);
  });
});

describe("AccountContractsTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without contracts:view and never reads the contracts", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts"]) });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    await screen.findByText(/Needs the contracts:view permission/);
    expect(calls.some((call) => call.key === LIST)).toBe(false);
  });

  it("lists the contracts with their handling and rules and offers no edit without contracts:manage", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "contracts:view"]),
      [ENGAGEMENTS]: () => json([anEngagement()]),
      [LIST]: () =>
        json([
          aContract({ engagement_id: ENGAGEMENT_ID }),
          aPremiumContract({ id: "c-2", key: "CT10002", name: "Premium block", model: "prepaid_block" }),
          aCompTimeContract({
            id: "c-3",
            key: "CT10003",
            name: "Comp retainer",
            status: "draft",
            overage_rule: "block",
            rollover_rule: "carry_month",
          }),
        ]),
      [CARDS]: () => json([]),
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    // The key shows in the list and again on its rate cards disclosure.
    await screen.findAllByText("CT10003");
    expect(screen.getByText("None")).toHaveAttribute("data-handling", "none");
    expect(screen.getByText("Premium 1.5x per contract")).toHaveAttribute("data-handling", "premium_rate");
    expect(screen.getByText("Comp time")).toHaveAttribute("data-handling", "comp_time");
    expect(screen.getByText("Prepaid block")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(document.querySelector('[data-rules="c-3"]')).toHaveTextContent(
      "Overage blocked; carries a month; thresholds 50, 75, 90, 100%",
    );
    expect(document.querySelector('[data-technologies="c-3"]')).toHaveTextContent("No codes");
    // The Engagement column names the engagement the contract is filed under.
    expect(document.querySelector(`[data-engagement="${CONTRACT_ID}"]`)).toHaveTextContent("Managed services 2026");
    expect(document.querySelector('[data-engagement="c-3"]')).toHaveTextContent("Not filed");
    expect(screen.queryByRole("button", { name: /Edit rules/ })).not.toBeInTheDocument();
  });

  it("files a contract under an engagement through the rules editor", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "contracts:view", "contracts:manage"]),
      [ENGAGEMENTS]: () => json([anEngagement()]),
      [LIST]: () => json([aContract()]),
      [CARDS]: () => json([]),
      [PATCH]: () => json(aContract({ engagement_id: ENGAGEMENT_ID, version: 2 })),
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit rules for CT10001" }));
    const editor = screen.getByLabelText("Contract rules for CT10001");
    const picker = within(editor).getByLabelText("Engagement");
    expect(picker).toHaveValue("");
    fireEvent.change(picker, { target: { value: ENGAGEMENT_ID } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save rules" }));

    await waitFor(() => expect(calls.some((call) => call.key === PATCH)).toBe(true));
    expect(calls.find((call) => call.key === PATCH)?.body).toEqual({
      version: 1,
      after_hours_handling: "none",
      ...DEFAULT_RULES,
      engagement_id: ENGAGEMENT_ID,
    });
  });

  it("lists the required technologies by code and saves them through the rules editor", async () => {
    let saved = false;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "contracts:view", "contracts:manage"]),
      [LIST]: () =>
        json([
          aContract(
            saved ? { technology_codes: ["onestream", "sap"], version: 2 } : { technology_codes: ["onestream"] },
          ),
        ]),
      [CARDS]: () => json([]),
      [PATCH]: () => {
        saved = true;
        return json(aContract({ technology_codes: ["onestream", "sap"], version: 2 }));
      },
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    await waitFor(() =>
      expect(document.querySelector(`[data-technologies="${CONTRACT_ID}"]`)).toHaveTextContent("onestream"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit rules for CT10001" }));
    const editor = screen.getByLabelText("Contract rules for CT10001");
    const codes = within(editor).getByLabelText("Technology codes");
    expect(codes).toHaveValue("onestream");
    fireEvent.change(codes, { target: { value: "onestream, Bad Code" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save rules" }));
    expect(within(editor).getByRole("alert")).toHaveTextContent(/^Technology codes are lower-case/);
    expect(calls.some((call) => call.key === PATCH)).toBe(false);
    fireEvent.change(codes, { target: { value: "onestream, SAP" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save rules" }));
    await screen.findByText("Contract rules saved");
    expect(calls.find((call) => call.key === PATCH)?.body).toEqual({
      version: 1,
      after_hours_handling: "none",
      ...DEFAULT_RULES,
      technology_codes: ["onestream", "sap"],
    });
    await waitFor(() =>
      expect(document.querySelector(`[data-technologies="${CONTRACT_ID}"]`)).toHaveTextContent("onestream, sap"),
    );
  });

  it("saves premium rate with its multiplier and the version through PATCH, then shows the new handling", async () => {
    let saved = false;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "contracts:view", "contracts:manage"]),
      [LIST]: () => json([saved ? aPremiumContract({ version: 2 }) : aContract()]),
      [CARDS]: () => json([]),
      [PATCH]: () => {
        saved = true;
        return json(aPremiumContract({ version: 2 }));
      },
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit rules for CT10001" }));
    const editor = screen.getByLabelText("Contract rules for CT10001");
    expect(within(editor).queryByLabelText("Multiplier")).not.toBeInTheDocument();
    fireEvent.change(within(editor).getByLabelText("After-hours handling"), { target: { value: "premium_rate" } });
    const multiplier = within(editor).getByLabelText("Multiplier");
    fireEvent.change(multiplier, { target: { value: "0.5" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save rules" }));
    expect(within(editor).getByRole("alert")).toHaveTextContent("The multiplier must be 1 or more.");
    expect(calls.some((call) => call.key === PATCH)).toBe(false);
    fireEvent.change(multiplier, { target: { value: "1.5" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save rules" }));
    await screen.findByText(/^CT10001: Premium 1.5x per contract; Overage allowed with flag/);
    expect(calls.find((call) => call.key === PATCH)?.body).toEqual({
      version: 1,
      after_hours_handling: "premium_rate",
      after_hours_multiplier: 1.5,
      ...DEFAULT_RULES,
    });
    await waitFor(() => expect(screen.getByText("Premium 1.5x per contract")).toBeInTheDocument());
    expect(screen.queryByLabelText("Contract rules for CT10001")).not.toBeInTheDocument();
  });

  it("sends comp time without a multiplier and words multiplier_required and the stale version", async () => {
    let attempt = 0;
    let reads = 0;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "contracts:manage"]),
      [LIST]: () => {
        reads += 1;
        return json([aPremiumContract({ version: reads })]);
      },
      [CARDS]: () => json([]),
      [PATCH]: () => {
        attempt += 1;
        if (attempt === 1) return json({ code: "multiplier_required", handling: "premium_rate" }, 400);
        if (attempt === 2) return json({ code: "stale_version" }, 409);
        return json(aCompTimeContract({ version: 3 }));
      },
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit rules for CT10001" }));
    const editor = () => screen.getByLabelText("Contract rules for CT10001");
    // The editor opens on the contract's current handling with its multiplier.
    expect(within(editor()).getByLabelText("After-hours handling")).toHaveValue("premium_rate");
    expect(within(editor()).getByLabelText("Multiplier")).toHaveValue("1.5");
    fireEvent.click(within(editor()).getByRole("button", { name: "Save rules" }));
    await within(editor()).findByText("Premium rate needs a multiplier, for example 1.5.");
    fireEvent.change(within(editor()).getByLabelText("After-hours handling"), { target: { value: "comp_time" } });
    expect(within(editor()).queryByLabelText("Multiplier")).not.toBeInTheDocument();
    fireEvent.click(within(editor()).getByRole("button", { name: "Save rules" }));
    await screen.findByText("Someone else changed this contract. It has been reloaded.");
    // The stale answer reloads the list; the editor remounts on the new version.
    await waitFor(() => expect(reads).toBe(2));
    await waitFor(() => expect(screen.getByText(/version 2$/)).toBeInTheDocument());
    fireEvent.change(within(editor()).getByLabelText("After-hours handling"), { target: { value: "comp_time" } });
    fireEvent.click(within(editor()).getByRole("button", { name: "Save rules" }));
    await screen.findByText(/^CT10001: Comp time;/);
    expect(calls.filter((call) => call.key === PATCH).map((call) => call.body)).toEqual([
      { version: 1, after_hours_handling: "premium_rate", after_hours_multiplier: 1.5, ...DEFAULT_RULES },
      { version: 1, after_hours_handling: "comp_time", ...DEFAULT_RULES },
      { version: 2, after_hours_handling: "comp_time", ...DEFAULT_RULES },
    ]);
  });

  it("saves the budget rules with the overage multiplier and the cap only under their rules, wording the refusals", async () => {
    let attempt = 0;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "contracts:manage"]),
      [LIST]: () => json([aContract()]),
      [CARDS]: () => json([]),
      [PATCH]: () => {
        attempt += 1;
        if (attempt === 1) return json({ code: "multiplier_required", handling: "allow_rate" }, 400);
        if (attempt === 2) return json({ code: "cap_required", rule: "cap" }, 400);
        return json(
          aContract({
            version: 2,
            overage_rule: "allow_rate",
            overage_multiplier: "1.250",
            rollover_rule: "cap",
            rollover_cap_hours: "20.00",
            threshold_percents: [80, 100],
            threshold_notify_client: true,
            forecast_window_days: 5,
          }),
        );
      },
    });
    renderDesk(<AccountContractsTab accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit rules for CT10001" }));
    const editor = screen.getByLabelText("Contract rules for CT10001");
    expect(within(editor).queryByLabelText("Overage multiplier")).not.toBeInTheDocument();
    expect(within(editor).queryByLabelText("Cap hours")).not.toBeInTheDocument();

    fireEvent.change(within(editor).getByLabelText("Thresholds"), { target: { value: "80, x" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save rules" }));
    expect(within(editor).getByRole("alert")).toHaveTextContent(/^Thresholds are whole percentages/);
    expect(calls.some((call) => call.key === PATCH)).toBe(false);

    fireEvent.change(within(editor).getByLabelText("Thresholds"), { target: { value: "80, 100" } });
    fireEvent.change(within(editor).getByLabelText("Overage rule"), { target: { value: "allow_rate" } });
    fireEvent.change(within(editor).getByLabelText("Overage multiplier"), { target: { value: "1.25" } });
    fireEvent.change(within(editor).getByLabelText("Rollover rule"), { target: { value: "cap" } });
    fireEvent.change(within(editor).getByLabelText("Cap hours"), { target: { value: "20" } });
    fireEvent.click(within(editor).getByLabelText("Notify the client contact at each threshold"));
    fireEvent.change(within(editor).getByLabelText("Forecast window days"), { target: { value: "5" } });
    fireEvent.click(within(editor).getByRole("button", { name: "Save rules" }));
    await within(editor).findByText("Allow at overage rate needs a multiplier, for example 1.25.");
    fireEvent.click(within(editor).getByRole("button", { name: "Save rules" }));
    await within(editor).findByText("Cap needs the carried hours limit, for example 20.");
    fireEvent.click(within(editor).getByRole("button", { name: "Save rules" }));
    await screen.findByText("CT10001: None; Overage at 1.25x; carries to term, capped at 20 h; thresholds 80, 100%.");
    const expected = {
      version: 1,
      engagement_id: null,
      after_hours_handling: "none",
      threshold_percents: [80, 100],
      threshold_notify_client: true,
      overage_rule: "allow_rate",
      overage_multiplier: 1.25,
      rollover_rule: "cap",
      rollover_cap_hours: 20,
      forecast_window_days: 5,
      technology_codes: [],
    };
    expect(calls.filter((call) => call.key === PATCH).map((call) => call.body)).toEqual([expected, expected, expected]);

    // Back to the rules that need no number: the multiplier and the cap leave the body.
    fireEvent.click(await screen.findByRole("button", { name: "Edit rules for CT10001" }));
    const again = screen.getByLabelText("Contract rules for CT10001");
    fireEvent.change(within(again).getByLabelText("Overage rule"), { target: { value: "block" } });
    fireEvent.change(within(again).getByLabelText("Rollover rule"), { target: { value: "carry_month" } });
    expect(within(again).queryByLabelText("Overage multiplier")).not.toBeInTheDocument();
    expect(within(again).queryByLabelText("Cap hours")).not.toBeInTheDocument();
    fireEvent.click(within(again).getByRole("button", { name: "Save rules" }));
    await waitFor(() => expect(calls.filter((call) => call.key === PATCH)).toHaveLength(4));
    expect(calls.filter((call) => call.key === PATCH)[3].body).toEqual({
      version: 1,
      engagement_id: null,
      after_hours_handling: "none",
      threshold_percents: [50, 75, 90, 100],
      threshold_notify_client: false,
      overage_rule: "block",
      rollover_rule: "carry_month",
      forecast_window_days: 10,
      technology_codes: [],
    });
  });
});
