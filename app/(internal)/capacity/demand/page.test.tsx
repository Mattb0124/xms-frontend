import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CapacityDemandPage from "@/app/(internal)/capacity/demand/page";
import { demandBody, emptyDemandDraft, validateDemand } from "@/components/capacity/demand-form";
import { overlayWidths } from "@/components/capacity/demand-overlay";
import {
  ACCOUNT_ID,
  aDemandList,
  aDemandRow,
  anImportResult,
  aProjectDemandRow,
  DEMAND_ID,
  OTHER_ACCOUNT_ID,
  OTHER_DEMAND_ID,
} from "@/redux/capacityApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const navigation = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/capacity/demand",
  useRouter: () => ({ replace: navigation.replace, push: navigation.push }),
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID, OTHER_ACCOUNT_ID], permissions } });

const LIST = "GET /v1/demand";
const ACCOUNTS = [
  { id: ACCOUNT_ID, key: "BRK", name: "Brookfield", status: "active" },
  { id: OTHER_ACCOUNT_ID, key: "AUS", name: "Austral Mining", status: "active" },
];

describe("demand form helpers", () => {
  it("builds the POST body with the subject once and the probability only for pipeline", () => {
    const draft = {
      ...emptyDemandDraft("2026-12"),
      prospect: " Acme Corp ",
      hours: "200",
      probability: "50",
      role: "architect",
      note: " Two pursuits ",
    };
    expect(validateDemand(draft)).toBeNull();
    expect(demandBody(draft)).toEqual({
      source: "pipeline",
      prospect_name: "Acme Corp",
      month: "2026-12",
      hours: 200,
      probability: 0.5,
      role: "architect",
      note: "Two pursuits",
    });
    // An account wins over a prospect; project demand carries no probability, role or note unless given.
    expect(demandBody({ ...draft, source: "project", accountId: ACCOUNT_ID, hours: "40", role: "", note: "" })).toEqual(
      {
        source: "project",
        account_id: ACCOUNT_ID,
        month: "2026-12",
        hours: 40,
      },
    );
  });

  it("refuses a draft without a subject, a bad month, bad hours or a pipeline probability off the scale", () => {
    const draft = { ...emptyDemandDraft("2026-12"), hours: "10" };
    expect(validateDemand(draft)).toBe("Name an account or a prospect.");
    expect(validateDemand({ ...draft, prospect: "X", month: "2026-13" })).toBe("The month must be written as YYYY-MM.");
    expect(validateDemand({ ...draft, prospect: "X", hours: "-1" })).toBe("Hours must be a number of 0 or more.");
    expect(validateDemand({ ...draft, prospect: "X", probability: "0" })).toBe(
      "The probability is a whole percentage from 1 to 100.",
    );
    expect(validateDemand({ ...draft, prospect: "X", probability: "101" })).toMatch(/from 1 to 100/);
    expect(validateDemand({ ...draft, source: "project", accountId: ACCOUNT_ID, probability: "" })).toBeNull();
  });

  it("sizes the overlay's segments against the scale", () => {
    expect(overlayWidths({ allocated: 12000, pipeline: 6000, project: 2400, scale: 20400 })).toEqual({
      allocated: "58.82%",
      pipeline: "29.41%",
      project: "11.76%",
    });
    expect(overlayWidths({ allocated: 0, pipeline: 0, project: 0, scale: 0 })).toEqual({
      allocated: "0%",
      pipeline: "0%",
      project: "0%",
    });
  });
});

describe("CapacityDemandPage", () => {
  beforeEach(() => {
    navigation.search = "";
    navigation.replace.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without capacity:view and never asks for the demand", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["tickets:view", "capacity:manage"]) });
    renderDesk(<CapacityDemandPage />);
    await screen.findByText("Not permitted");
    expect(calls.some((call) => call.key === LIST)).toBe(false);
  });

  it("sends the URL range and account to the API and lists the lines read only with the totals", async () => {
    navigation.search = `from=2026-09&to=2026-12&account=${ACCOUNT_ID}`;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view"]),
      [LIST]: () => json(aDemandList()),
    });
    renderDesk(<CapacityDemandPage />);
    const table = await screen.findByRole("table", { name: "Demand lines" });
    expect(decodeURIComponent(calls.find((call) => call.key === LIST)?.search ?? "")).toBe(
      `?from=2026-09&to=2026-12&account=${ACCOUNT_ID}`,
    );
    expect(calls.some((call) => call.key === "GET /v1/accounts")).toBe(false);
    const pipeline = table.querySelector(`[data-demand="${DEMAND_ID}"]`) as HTMLElement;
    expect(within(pipeline).getByText("Pipeline")).toHaveAttribute("data-state", "ready");
    expect(pipeline.querySelector("[data-subject]")).toHaveTextContent("Acme Corp");
    expect(pipeline.querySelector("[data-subject]")).toHaveTextContent("prospect");
    expect(pipeline.querySelector("[data-month]")).toHaveTextContent("December 2026");
    expect(pipeline.querySelector("[data-hours]")).toHaveTextContent("200 h");
    expect(pipeline.querySelector("[data-probability]")).toHaveTextContent("50%");
    expect(pipeline.querySelector("[data-weighted]")).toHaveTextContent("100 h");
    expect(pipeline.querySelector("[data-role]")).toHaveTextContent("Architect");
    expect(pipeline.querySelector("[data-note]")).toHaveTextContent("Two pursuits closing");
    const project = table.querySelector(`[data-demand="${OTHER_DEMAND_ID}"]`) as HTMLElement;
    expect(within(project).getByText("Project")).toHaveAttribute("data-state", "complete");
    expect(project.querySelector("[data-subject]")).toHaveTextContent("BRK");
    expect(project.querySelector("[data-probability]")).toHaveTextContent("");
    expect(project.querySelector("[data-weighted]")).toHaveTextContent("40 h");
    const totals = screen.getByTestId("demand-totals");
    expect(totals.querySelector("[data-total-pipeline]")).toHaveTextContent("100 h pipeline, weighted");
    expect(totals.querySelector("[data-total-project]")).toHaveTextContent("40 h project");
    expect(totals.querySelector("[data-total]")).toHaveTextContent("140 h in all");
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Add demand" })).not.toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "Import demand" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Filter by account")).toBeDisabled();
    expect(screen.getByRole("link", { name: "Demand" })).toHaveAttribute("aria-current", "page");
  });

  it("opens on the current month to three months ahead and rewrites the URL from the pickers", async () => {
    stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "tickets:view"]),
      [LIST]: () => json(aDemandList({ rows: [] })),
      "GET /v1/accounts": () => json(ACCOUNTS),
    });
    renderDesk(<CapacityDemandPage />);
    await screen.findByText("No demand in this range.");
    const from = screen.getByLabelText("From month") as HTMLInputElement;
    const to = screen.getByLabelText("To month") as HTMLInputElement;
    const [year, month] = from.value.split("-").map(Number);
    const expectedTo = new Date(Date.UTC(year, month - 1 + 3, 1));
    expect(to.value).toBe(`${expectedTo.getUTCFullYear()}-${String(expectedTo.getUTCMonth() + 1).padStart(2, "0")}`);
    fireEvent.change(to, { target: { value: from.value } });
    expect(navigation.replace).toHaveBeenLastCalledWith(`/capacity/demand?to=${from.value}`);
    await screen.findByRole("option", { name: "AUS Austral Mining" });
    fireEvent.change(screen.getByLabelText("Filter by account"), { target: { value: OTHER_ACCOUNT_ID } });
    expect(navigation.replace).toHaveBeenLastCalledWith(`/capacity/demand?account=${OTHER_ACCOUNT_ID}`);
  });

  it("removes a line behind a confirm under capacity:manage and reloads the list", async () => {
    navigation.search = "from=2026-09&to=2026-12";
    let reads = 0;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "capacity:manage", "tickets:view"]),
      [LIST]: () => {
        reads += 1;
        return json(reads > 1 ? aDemandList({ rows: [aProjectDemandRow()] }) : aDemandList());
      },
      "GET /v1/accounts": () => json(ACCOUNTS),
      [`DELETE /v1/demand/${DEMAND_ID}`]: () => json({ removed: DEMAND_ID }),
    });
    renderDesk(<CapacityDemandPage />);
    const table = await screen.findByRole("table", { name: "Demand lines" });
    const pipeline = table.querySelector(`[data-demand="${DEMAND_ID}"]`) as HTMLElement;
    fireEvent.click(within(pipeline).getByRole("button", { name: "Remove" }));
    expect(calls.some((call) => call.key.startsWith("DELETE"))).toBe(false);
    fireEvent.click(within(pipeline).getByRole("button", { name: "Confirm remove" }));
    await screen.findByText("Demand removed");
    expect(screen.getByText("Acme Corp, December 2026.")).toBeInTheDocument();
    expect(calls.filter((call) => call.key === `DELETE /v1/demand/${DEMAND_ID}`)).toHaveLength(1);
    await waitFor(() => expect(reads).toBe(2));
    await waitFor(() => expect(table.querySelector(`[data-demand="${DEMAND_ID}"]`)).toBeNull());
  });

  it("adds pipeline demand with the probability and project demand without it, wording subject_required", async () => {
    navigation.search = "from=2026-12&to=2026-12";
    let attempt = 0;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "capacity:manage", "tickets:view"]),
      [LIST]: () => json(aDemandList({ rows: [] })),
      "GET /v1/accounts": () => json(ACCOUNTS),
      "POST /v1/demand": () => {
        attempt += 1;
        if (attempt === 1) return json({ code: "subject_required" }, 400);
        return json(attempt === 2 ? aDemandRow() : aProjectDemandRow(), 201);
      },
    });
    renderDesk(<CapacityDemandPage />);
    const form = await screen.findByRole("form", { name: "Add demand" });
    await within(form).findByRole("option", { name: "BRK Brookfield" });
    expect(within(form).getByLabelText("Demand month")).toHaveValue("2026-12");
    expect(within(form).getByLabelText("Probability")).toBeInTheDocument();
    // Nothing named: refused here before the API is asked.
    fireEvent.change(within(form).getByLabelText("Hours"), { target: { value: "200" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add demand" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Name an account or a prospect.");
    expect(calls.some((call) => call.key === "POST /v1/demand")).toBe(false);
    // The server's own subject_required, worded the same way.
    fireEvent.change(within(form).getByLabelText("Prospect"), { target: { value: "Acme Corp" } });
    fireEvent.change(within(form).getByLabelText("Role"), { target: { value: "architect" } });
    fireEvent.change(within(form).getByLabelText("Note"), { target: { value: "Two pursuits closing" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add demand" }));
    await within(form).findByText("Name an account or a prospect.");
    fireEvent.click(within(form).getByRole("button", { name: "Add demand" }));
    await screen.findByText("Demand added");
    expect(screen.getByText("Acme Corp, pipeline 200 h in December 2026.")).toBeInTheDocument();
    // The form clears to the month; project demand then goes without a probability.
    expect(within(form).getByLabelText("Hours")).toHaveValue(null);
    fireEvent.change(within(form).getByLabelText("Source"), { target: { value: "project" } });
    expect(within(form).queryByLabelText("Probability")).not.toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText("Account"), { target: { value: ACCOUNT_ID } });
    expect(within(form).queryByLabelText("Prospect")).not.toBeInTheDocument();
    fireEvent.change(within(form).getByLabelText("Hours"), { target: { value: "40" } });
    fireEvent.click(within(form).getByRole("button", { name: "Add demand" }));
    await screen.findByText("BRK, project 40 h in December 2026.");
    expect(calls.filter((call) => call.key === "POST /v1/demand").map((call) => call.body)).toEqual([
      {
        source: "pipeline",
        prospect_name: "Acme Corp",
        month: "2026-12",
        hours: 200,
        probability: 0.5,
        role: "architect",
        note: "Two pursuits closing",
      },
      {
        source: "pipeline",
        prospect_name: "Acme Corp",
        month: "2026-12",
        hours: 200,
        probability: 0.5,
        role: "architect",
        note: "Two pursuits closing",
      },
      { source: "project", account_id: ACCOUNT_ID, month: "2026-12", hours: 40 },
    ]);
    await waitFor(() => expect(calls.filter((call) => call.key === LIST).length).toBeGreaterThanOrEqual(3));
  });

  it("imports pasted CSV, renders invalid_import per line and words unknown_account keys", async () => {
    navigation.search = "from=2026-12&to=2027-01";
    let attempt = 0;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "capacity:manage"]),
      [LIST]: () => json(aDemandList({ rows: [] })),
      "POST /v1/demand/import": () => {
        attempt += 1;
        if (attempt === 1)
          return json(
            {
              code: "invalid_import",
              problems: [
                { line: 2, problem: 'month must be YYYY-MM, got "2026-13"' },
                { line: 2, problem: "an account key or a prospect name is required" },
                { line: 3, problem: 'source must be pipeline or project, got "maybe"' },
              ],
            },
            400,
          );
        if (attempt === 2) return json({ code: "unknown_account", keys: ["ZZZ"] }, 400);
        return json(anImportResult(), 201);
      },
    });
    renderDesk(<CapacityDemandPage />);
    const form = await screen.findByRole("form", { name: "Import demand" });
    expect(form.querySelector("[data-template-columns]")).toHaveTextContent(
      "source, account, prospect, month, hours, probability, role",
    );
    fireEvent.click(within(form).getByRole("button", { name: "Import" }));
    expect(within(form).getByRole("alert")).toHaveTextContent("Paste the template or pick a file first.");
    expect(calls.some((call) => call.key === "POST /v1/demand/import")).toBe(false);
    const bad = "source,month,hours\npipeline,2026-13,10\nmaybe,2026-12,5";
    fireEvent.change(within(form).getByLabelText("CSV content"), { target: { value: bad } });
    fireEvent.click(within(form).getByRole("button", { name: "Import" }));
    await within(form).findByText("The file has 3 problems; nothing was imported.");
    const problems = within(form).getByRole("list", { name: "Import problems" });
    expect(
      within(problems)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      'line 2month must be YYYY-MM, got "2026-13"',
      "line 2an account key or a prospect name is required",
      'line 3source must be pipeline or project, got "maybe"',
    ]);
    expect(calls.find((call) => call.key === "POST /v1/demand/import")?.body).toEqual({ content: bad });
    const unknown = "source,account,month,hours\nproject,zzz,2027-01,10";
    fireEvent.change(within(form).getByLabelText("CSV content"), { target: { value: unknown } });
    fireEvent.click(within(form).getByRole("button", { name: "Import" }));
    await within(form).findByText("Unknown or not granted account key: ZZZ. Nothing was imported.");
    expect(within(form).queryByRole("list", { name: "Import problems" })).not.toBeInTheDocument();
    const good =
      "source,account,prospect,month,hours,probability,role\nproject,brk,,2027-01,40,,\npipeline,,Globex,2027-01,100,25%,architect";
    fireEvent.change(within(form).getByLabelText("CSV content"), { target: { value: good } });
    fireEvent.click(within(form).getByRole("button", { name: "Import" }));
    await screen.findByText("Imported 2 lines");
    expect(within(form).getByLabelText("CSV content")).toHaveValue("");
    expect(calls.filter((call) => call.key === "POST /v1/demand/import").map((call) => call.body)).toEqual([
      { content: bad },
      { content: unknown },
      { content: good },
    ]);
  });

  it("reads a picked file as the CSV text", async () => {
    navigation.search = "from=2026-12&to=2026-12";
    const calls = stubFetch({
      "GET /v1/admin/me": me(["capacity:view", "capacity:manage"]),
      [LIST]: () => json(aDemandList({ rows: [] })),
      "POST /v1/demand/import": () => json(anImportResult({ rows: [aProjectDemandRow({ source: "import" })] }), 201),
    });
    renderDesk(<CapacityDemandPage />);
    const form = await screen.findByRole("form", { name: "Import demand" });
    const text = "source,account,month,hours\nproject,BRK,2026-12,40\n";
    const file = new File([text], "demand.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(text) });
    fireEvent.change(within(form).getByLabelText("CSV file"), { target: { files: [file] } });
    await waitFor(() => expect(within(form).getByLabelText("CSV content")).toHaveValue(text));
    expect(within(form).getByText("File: demand.csv")).toBeInTheDocument();
    fireEvent.click(within(form).getByRole("button", { name: "Import" }));
    await screen.findByText("Imported 1 line");
    expect(screen.getByText("demand.csv")).toBeInTheDocument();
    expect(calls.find((call) => call.key === "POST /v1/demand/import")?.body).toEqual({ content: text });
  });
});
