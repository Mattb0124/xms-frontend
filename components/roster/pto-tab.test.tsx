import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { canWritePto, ptoBody, PtoTab, rangeLabel } from "@/components/roster/pto-tab";
import { aPto, PTO_ID } from "@/redux/capacityApi.test";
import { PERSON_ID } from "@/redux/rosterApi.test";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/roster/${PERSON_ID}` }));

const PTO = `GET /v1/roster/people/${PERSON_ID}/pto`;

const me = (userId: string, permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId, accountIds: [], permissions } });

describe("PTO rules and bodies", () => {
  it("mirrors the server's self-or-manage rule", () => {
    expect(canWritePto("u-ana", "u-ana", false)).toBe(true);
    expect(canWritePto("u-ben", "u-ana", false)).toBe(false);
    expect(canWritePto("u-ben", "u-ana", true)).toBe(true);
    expect(canWritePto("u-ana", null, false)).toBe(false);
    expect(canWritePto(undefined, "u-ana", false)).toBe(false);
  });

  it("sends the fraction only for half days and the note only when given; a missing end is the start", () => {
    expect(ptoBody({ starts_on: "2026-09-14", ends_on: "2026-09-16", kind: "vacation", length: "full", note: " " })).toEqual({
      starts_on: "2026-09-14",
      ends_on: "2026-09-16",
      kind: "vacation",
    });
    expect(ptoBody({ starts_on: "2026-09-21", ends_on: "", kind: "sick", length: "half", note: "Dentist" })).toEqual({
      starts_on: "2026-09-21",
      ends_on: "2026-09-21",
      kind: "sick",
      fraction: 0.5,
      note: "Dentist",
    });
    expect(rangeLabel("2026-09-14", "2026-09-16")).toBe("2026-09-14 to 2026-09-16");
    expect(rangeLabel("2026-09-21", "2026-09-21")).toBe("2026-09-21");
  });
});

describe("PtoTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("lets the person themselves list and add their own time off without capacity:manage", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me("u-ana", ["time:log", "capacity:view"]),
      [PTO]: () => json([aPto(), aPto({ id: "pto-2", starts_on: "2026-09-21", ends_on: "2026-09-21", kind: "sick", fraction: "0.50" })]),
      [`POST /v1/roster/people/${PERSON_ID}/pto`]: () => json(aPto({ id: "pto-3" }), 201),
    });
    renderDesk(<PtoTab personId={PERSON_ID} userId="u-ana" canManage={false} />);
    const list = await screen.findByRole("list", { name: "Time off" });
    expect(list).toHaveTextContent("2026-09-14 to 2026-09-16");
    expect(list).toHaveTextContent("Vacation");
    expect(list).toHaveTextContent("Full days");
    expect(list).toHaveTextContent("Half days");
    fireEvent.change(screen.getByLabelText("Starts on"), { target: { value: "2026-10-05" } });
    fireEvent.change(screen.getByLabelText("Ends on"), { target: { value: "2026-10-06" } });
    fireEvent.change(screen.getByLabelText("Kind"), { target: { value: "other" } });
    fireEvent.change(screen.getByLabelText("Length"), { target: { value: "half" } });
    fireEvent.change(screen.getByLabelText("Note"), { target: { value: "Moving house" } });
    fireEvent.click(screen.getByRole("button", { name: "Add time off" }));
    await waitFor(() => expect(calls.some((call) => call.key.startsWith("POST"))).toBe(true));
    expect(calls.find((call) => call.key.startsWith("POST"))?.body).toEqual({
      starts_on: "2026-10-05",
      ends_on: "2026-10-06",
      kind: "other",
      fraction: 0.5,
      note: "Moving house",
    });
    await waitFor(() => expect(screen.getByLabelText("Starts on")).toHaveValue(""));
  });

  it("words invalid_range under the form", async () => {
    stubFetch({
      "GET /v1/admin/me": me("u-ana", ["time:log"]),
      [PTO]: () => json([]),
      [`POST /v1/roster/people/${PERSON_ID}/pto`]: () => json({ code: "invalid_range" }, 400),
    });
    renderDesk(<PtoTab personId={PERSON_ID} userId="u-ana" canManage={false} />);
    await screen.findByText("No time off recorded.");
    fireEvent.change(screen.getByLabelText("Starts on"), { target: { value: "2026-10-06" } });
    fireEvent.change(screen.getByLabelText("Ends on"), { target: { value: "2026-10-05" } });
    // The end date's min guards the browser; submitting the form directly reaches the server's own check.
    fireEvent.submit(screen.getByRole("form", { name: "Add time off" }));
    await screen.findByText("The time off must end on or after it starts.");
  });

  it("neither lists nor offers the form to another reader without capacity:manage, and never asks the API", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me("u-ben", ["time:log", "capacity:view"]),
      [PTO]: () => json([aPto()]),
    });
    renderDesk(<PtoTab personId={PERSON_ID} userId="u-ana" canManage={false} />);
    await screen.findByText("Time off is visible to the person themselves and to capacity managers.");
    await waitFor(() => expect(calls.some((call) => call.key === "GET /v1/admin/me")).toBe(true));
    expect(calls.some((call) => call.key === PTO)).toBe(false);
    expect(screen.queryByRole("form", { name: "Add time off" })).not.toBeInTheDocument();
  });

  it("lets a capacity manager read anyone's time off and remove an entry after a confirm", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me("u-lead", ["time:log", "capacity:view", "capacity:manage"]),
      [PTO]: () => json([aPto()]),
      [`DELETE /v1/roster/people/${PERSON_ID}/pto/${PTO_ID}`]: () => json({ removed: PTO_ID }),
    });
    renderDesk(<PtoTab personId={PERSON_ID} userId="u-ana" canManage />);
    await screen.findByRole("list", { name: "Time off" });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(calls.some((call) => call.key.startsWith("DELETE"))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove" }));
    await waitFor(() => expect(calls.some((call) => call.key === `DELETE /v1/roster/people/${PERSON_ID}/pto/${PTO_ID}`)).toBe(true));
  });
});
