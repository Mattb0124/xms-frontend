import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EngagementsPanel } from "@/components/admin/contracts/engagements-panel";
import { AccountRenewalChips } from "@/components/admin/contracts/renewal-chip";
import { ACCOUNT_ID, ENGAGEMENT_ID, OWNER_USER_ID, anEngagement, anExpiringEngagement } from "@/redux/ticketsApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/admin/accounts/${ACCOUNT_ID}` }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const LIST = `GET /v1/accounts/${ACCOUNT_ID}/engagements`;
const CREATE = `POST /v1/accounts/${ACCOUNT_ID}/engagements`;
const PATCH = `PATCH /v1/accounts/${ACCOUNT_ID}/engagements/${ENGAGEMENT_ID}`;
const USERS = "GET /v1/admin/users";

/** The internal directory the owner picker reads when admin:users is held. */
const directory = () =>
  json([
    {
      id: OWNER_USER_ID,
      clerk_user_id: null,
      kind: "internal",
      account_id: null,
      email: "ada.ellis@example.test",
      first_name: "Ada",
      last_name: "Ellis",
      title: null,
      business_phone: null,
      mobile_phone: null,
      time_zone: "UTC",
      language: "en",
      date_format: "yyyy-MM-dd",
      status: "active",
      last_sign_in_at: null,
    },
  ]);

describe("EngagementsPanel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lists each engagement with its owner, dates, status and alert ledger", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "admin:users"]),
      [USERS]: directory,
      [LIST]: () => json([anEngagement(), anExpiringEngagement()]),
    });
    renderDesk(<EngagementsPanel accountId={ACCOUNT_ID} />);
    await screen.findByTestId("engagements");
    await screen.findByText("Managed services 2026");

    const table = screen.getByRole("table");
    // Both rows name the same owner, and both name them rather than an id.
    expect(within(table).getAllByText("Ada Ellis")).toHaveLength(2);
    expect(within(table).getByText("2027-03-31")).toBeInTheDocument();
    expect(within(table).getAllByText(/30 days of notice/)).toHaveLength(2);
    expect(within(table).getByText("decide by 2027-03-01")).toBeInTheDocument();
    expect(within(table).getByText("decide by 2026-09-01")).toBeInTheDocument();
    expect(within(table).getByText("None sent")).toBeInTheDocument();
    expect(within(table).getByText("90 days and 60 days")).toBeInTheDocument();
    expect(within(table).getByText("Active")).toBeInTheDocument();
    expect(within(table).getByText("Expiring")).toBeInTheDocument();
    // contracts:manage is not held, so nothing offers a write.
    expect(screen.queryByRole("button", { name: "New engagement" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Edit / })).not.toBeInTheDocument();
  });

  it("asks the API nothing without contracts:view and says why", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view"]) });
    renderDesk(<EngagementsPanel accountId={ACCOUNT_ID} />);
    await screen.findByText("You can see this account but not its engagements.");
    await waitFor(() => expect(calls.some((call) => call.key === "GET /v1/admin/me")).toBe(true));
    expect(calls.some((call) => call.key === LIST)).toBe(false);
  });

  it("adds an engagement, sending null for what was left empty", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "contracts:manage"]),
      [LIST]: () => json([]),
      [CREATE]: () => json(anEngagement({ name: "Renewal 2027" }), 201),
    });
    renderDesk(<EngagementsPanel accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "New engagement" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Renewal 2027" } });
    fireEvent.click(screen.getByRole("button", { name: "Add engagement" }));

    await waitFor(() => expect(calls.some((call) => call.key === CREATE)).toBe(true));
    expect(calls.find((call) => call.key === CREATE)?.body).toEqual({
      name: "Renewal 2027",
      owner_user_id: null,
      renewal_date: null,
      notice_period_days: null,
    });
    // The directory is not readable here, so the owner field takes an id by hand.
    expect(calls.some((call) => call.key === USERS)).toBe(false);
    await screen.findByText("Engagement added");
  });

  it("refuses a notice period with no renewal date before it asks the API", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "contracts:manage"]),
      [LIST]: () => json([]),
    });
    renderDesk(<EngagementsPanel accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "New engagement" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Renewal 2027" } });
    fireEvent.change(screen.getByLabelText("Notice period (days)"), { target: { value: "30" } });
    fireEvent.click(screen.getByRole("button", { name: "Add engagement" }));

    expect(await screen.findByText(/counted back from the renewal date/)).toBeInTheDocument();
    expect(calls.some((call) => call.key === CREATE)).toBe(false);
  });

  it("edits with the version, and sends the status only when it was changed by hand", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "contracts:manage"]),
      [LIST]: () => json([anEngagement()]),
      [PATCH]: () => json(anEngagement({ renewal_date: "2028-01-31", version: 2 })),
    });
    renderDesk(<EngagementsPanel accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Managed services 2026" }));
    fireEvent.change(screen.getByLabelText("Renewal date"), { target: { value: "2028-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Save engagement" }));

    await waitFor(() => expect(calls.some((call) => call.key === PATCH)).toBe(true));
    const body = calls.find((call) => call.key === PATCH)?.body as Record<string, unknown>;
    expect(body).toEqual({
      version: 1,
      name: "Managed services 2026",
      owner_user_id: OWNER_USER_ID,
      renewal_date: "2028-01-31",
      notice_period_days: 30,
    });
    // Untouched status: the server's own rule decides it from the new date.
    expect(body).not.toHaveProperty("status");
    await screen.findByText("Engagement saved");
  });

  it("words a stale version and closes onto the list the slice reloaded", async () => {
    let listed = [anEngagement()];
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view", "contracts:manage"]),
      [LIST]: () => json(listed),
      [PATCH]: () => {
        listed = [anEngagement({ name: "Managed services 2027", version: 9 })];
        return json({ code: "stale_version", current: 9 }, 409);
      },
    });
    renderDesk(<EngagementsPanel accountId={ACCOUNT_ID} />);
    fireEvent.click(await screen.findByRole("button", { name: "Edit Managed services 2026" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Renamed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save engagement" }));

    await waitFor(() => expect(calls.filter((call) => call.key === LIST).length).toBeGreaterThan(1));
    await screen.findByText("Managed services 2027");
    expect(screen.queryByRole("button", { name: "Save engagement" })).not.toBeInTheDocument();
  });
});

describe("AccountRenewalChips", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("announces the expiring engagement and names how long is left", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [LIST]: () => json([anEngagement(), anExpiringEngagement({ renewal_date: "2099-01-01" })]),
    });
    renderDesk(<AccountRenewalChips accountId={ACCOUNT_ID} />);
    const chips = await screen.findByTestId("renewal-chips");
    expect(within(chips).getAllByRole("listitem")).toHaveLength(1);
    expect(within(chips).getByRole("listitem")).toHaveTextContent(/^Hosting renewal renews in \d+ days$/);
    expect(calls.some((call) => call.key === LIST)).toBe(true);
  });

  it("renders nothing at all on an account with nothing expiring", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["contracts:view"]),
      [LIST]: () => json([anEngagement(), anEngagement({ id: ENGAGEMENT_ID, status: "ended" })]),
    });
    const { container } = renderDesk(<AccountRenewalChips accountId={ACCOUNT_ID} />);
    await waitFor(() => expect(calls.some((call) => call.key === LIST)).toBe(true));
    expect(container.querySelector("[data-testid='renewal-chips']")).toBeNull();
  });

  it("asks the API nothing without contracts:view", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view"]), [LIST]: () => json([anExpiringEngagement()]) });
    const { container } = renderDesk(<AccountRenewalChips accountId={ACCOUNT_ID} />);
    await waitFor(() => expect(calls.some((call) => call.key === "GET /v1/admin/me")).toBe(true));
    expect(container.querySelector("[data-testid='renewal-chips']")).toBeNull();
    expect(calls.some((call) => call.key === LIST)).toBe(false);
  });
});
