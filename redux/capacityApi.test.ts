import { afterEach, describe, expect, it, vi } from "vitest";
import { capacityApi } from "@/redux/capacityApi";
import { PERSON_ID } from "@/test-kit/roster";
import { makeStore } from "@/redux/store";
import { json, stubFetch } from "@/test-kit/portal";
import {
  aCapacityCheck,
  aCapacityView,
  ACCOUNT_ID,
  aDemandList,
  aDemandRow,
  anAllocation,
  anImportResult,
  aPto,
  aSkillsMatrixPeople,
  aVarianceReport,
  DEMAND_ID,
  OTHER_ACCOUNT_ID,
  OTHER_PERSON_ID,
  PTO_ID,
} from "@/test-kit/capacity";

describe("capacityApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads PTO, the view with its filters, the check, the variance and the allocations with the API's parameter names", async () => {
    const calls = stubFetch({
      [`GET /v1/roster/people/${PERSON_ID}/pto`]: () => json([aPto()]),
      "GET /v1/capacity": () => json(aCapacityView()),
      "GET /v1/capacity/check": () => json([aCapacityCheck()]),
      "GET /v1/capacity/variance": () => json(aVarianceReport()),
      "GET /v1/allocations": () => json([anAllocation()]),
    });
    const store = makeStore();
    await store.dispatch(capacityApi.endpoints.listPto.initiate(PERSON_ID)).unwrap();
    await store.dispatch(capacityApi.endpoints.capacityView.initiate()).unwrap();
    const view = await store
      .dispatch(
        capacityApi.endpoints.capacityView.initiate({
          month: "2026-09",
          group: "g-1",
          role: "consultant",
          account: ACCOUNT_ID,
        }),
      )
      .unwrap();
    expect(view.totals.allocated_minutes).toBe(12000);
    await store
      .dispatch(
        capacityApi.endpoints.capacityCheck.initiate({ personIds: [PERSON_ID, OTHER_PERSON_ID], month: "2026-09" }),
      )
      .unwrap();
    await store
      .dispatch(
        capacityApi.endpoints.capacityVariance.initiate({ month: "2026-09", account: ACCOUNT_ID, person: PERSON_ID }),
      )
      .unwrap();
    await store
      .dispatch(capacityApi.endpoints.listAllocations.initiate({ account: ACCOUNT_ID, from: "2026-09", to: "2026-11" }))
      .unwrap();
    expect(calls.map((call) => `${call.key}${decodeURIComponent(call.search)}`)).toEqual([
      `GET /v1/roster/people/${PERSON_ID}/pto`,
      "GET /v1/capacity",
      `GET /v1/capacity?month=2026-09&group=g-1&role=consultant&account=${ACCOUNT_ID}`,
      `GET /v1/capacity/check?person_ids=${PERSON_ID},${OTHER_PERSON_ID}&month=2026-09`,
      `GET /v1/capacity/variance?month=2026-09&account=${ACCOUNT_ID}&person=${PERSON_ID}`,
      `GET /v1/allocations?account=${ACCOUNT_ID}&from=2026-09&to=2026-11`,
    ]);
  });

  it("caps the check at 50 ids", async () => {
    const calls = stubFetch({ "GET /v1/capacity/check": () => json([]) });
    const store = makeStore();
    const ids = Array.from({ length: 60 }, (_, index) => `p-${index}`);
    await store.dispatch(capacityApi.endpoints.capacityCheck.initiate({ personIds: ids })).unwrap();
    const sent = new URLSearchParams(calls[0].search).get("person_ids")?.split(",") ?? [];
    expect(sent).toHaveLength(50);
    expect(sent[0]).toBe("p-0");
    expect(sent[49]).toBe("p-49");
    expect(calls[0].search).not.toContain("month");
  });

  it("sends the PTO and allocation mutations with the contract bodies", async () => {
    const calls = stubFetch({
      [`POST /v1/roster/people/${PERSON_ID}/pto`]: () => json(aPto({ fraction: "0.50" }), 201),
      [`DELETE /v1/roster/people/${PERSON_ID}/pto/${PTO_ID}`]: () => json({ removed: PTO_ID }),
      "PUT /v1/allocations": () =>
        json({
          cells: [
            anAllocation({ version: 3 }),
            { removed: true, person_id: PERSON_ID, account_id: OTHER_ACCOUNT_ID, month: "2026-09-01" },
          ],
        }),
    });
    const store = makeStore();
    const pto = await store
      .dispatch(
        capacityApi.endpoints.addPto.initiate({
          personId: PERSON_ID,
          body: { starts_on: "2026-09-21", ends_on: "2026-09-21", kind: "sick", fraction: 0.5, note: "Dentist" },
        }),
      )
      .unwrap();
    expect(pto.fraction).toBe("0.50");
    await store.dispatch(capacityApi.endpoints.removePto.initiate({ personId: PERSON_ID, ptoId: PTO_ID })).unwrap();
    const put = await store
      .dispatch(
        capacityApi.endpoints.putAllocations.initiate({
          cells: [
            { person_id: PERSON_ID, account_id: ACCOUNT_ID, month: "2026-09-01", planned_minutes: 4200, version: 2 },
            { person_id: PERSON_ID, account_id: OTHER_ACCOUNT_ID, month: "2026-09-01", planned_minutes: 0 },
          ],
        }),
      )
      .unwrap();
    expect(put.cells[1]).toMatchObject({ removed: true });
    expect(calls.map((call) => [call.key, call.body])).toEqual([
      [
        `POST /v1/roster/people/${PERSON_ID}/pto`,
        { starts_on: "2026-09-21", ends_on: "2026-09-21", kind: "sick", fraction: 0.5, note: "Dentist" },
      ],
      [`DELETE /v1/roster/people/${PERSON_ID}/pto/${PTO_ID}`, undefined],
      [
        "PUT /v1/allocations",
        {
          cells: [
            { person_id: PERSON_ID, account_id: ACCOUNT_ID, month: "2026-09-01", planned_minutes: 4200, version: 2 },
            { person_id: PERSON_ID, account_id: OTHER_ACCOUNT_ID, month: "2026-09-01", planned_minutes: 0 },
          ],
        },
      ],
    ]);
  });

  it("reads both lenses of the skills matrix and the demand list with the API's parameter names", async () => {
    const calls = stubFetch({
      "GET /v1/capacity/skills-matrix": () => json(aSkillsMatrixPeople()),
      "GET /v1/demand": () => json(aDemandList()),
    });
    const store = makeStore();
    const people = await store.dispatch(capacityApi.endpoints.skillsMatrixPeople.initiate()).unwrap();
    expect(people.people[0].levels.onestream).toBe(4);
    await store.dispatch(capacityApi.endpoints.skillsMatrixAccount.initiate()).unwrap();
    await store.dispatch(capacityApi.endpoints.skillsMatrixAccount.initiate({ account: ACCOUNT_ID })).unwrap();
    await store.dispatch(capacityApi.endpoints.listDemand.initiate()).unwrap();
    const list = await store
      .dispatch(capacityApi.endpoints.listDemand.initiate({ from: "2026-09", to: "2026-12", account: ACCOUNT_ID }))
      .unwrap();
    expect(list.totals).toEqual({ pipeline_minutes_weighted: 6000, project_minutes: 2400, total_minutes: 8400 });
    expect(calls.map((call) => `${call.key}${decodeURIComponent(call.search)}`)).toEqual([
      "GET /v1/capacity/skills-matrix?lens=people",
      "GET /v1/capacity/skills-matrix?lens=account",
      `GET /v1/capacity/skills-matrix?lens=account&account=${ACCOUNT_ID}`,
      "GET /v1/demand",
      `GET /v1/demand?from=2026-09&to=2026-12&account=${ACCOUNT_ID}`,
    ]);
  });

  it("adds, removes and imports demand with the contract bodies, reloading the list and the month view", async () => {
    let lists = 0;
    let views = 0;
    const calls = stubFetch({
      "GET /v1/demand": () => {
        lists += 1;
        return json(aDemandList());
      },
      "GET /v1/capacity": () => {
        views += 1;
        return json(aCapacityView());
      },
      "POST /v1/demand": () => json(aDemandRow(), 201),
      [`DELETE /v1/demand/${DEMAND_ID}`]: () => json({ removed: DEMAND_ID }),
      "POST /v1/demand/import": () => json(anImportResult(), 201),
    });
    const store = makeStore();
    const list = store.dispatch(capacityApi.endpoints.listDemand.initiate({ from: "2026-12" }));
    const view = store.dispatch(capacityApi.endpoints.capacityView.initiate({ month: "2026-12" }));
    await list.unwrap();
    await view.unwrap();
    const added = await store
      .dispatch(
        capacityApi.endpoints.addDemand.initiate({
          source: "pipeline",
          prospect_name: "Acme Corp",
          month: "2026-12",
          hours: 200,
          probability: 0.5,
          role: "architect",
          note: "Two pursuits closing",
        }),
      )
      .unwrap();
    expect(added.id).toBe(DEMAND_ID);
    await vi.waitFor(() => expect([lists, views]).toEqual([2, 2]));
    await store.dispatch(capacityApi.endpoints.removeDemand.initiate(DEMAND_ID)).unwrap();
    await vi.waitFor(() => expect([lists, views]).toEqual([3, 3]));
    const content = "source,account,month,hours\nproject,BRK,2026-12,40\n";
    const imported = await store.dispatch(capacityApi.endpoints.importDemand.initiate({ content })).unwrap();
    expect(imported.imported).toBe(2);
    await vi.waitFor(() => expect([lists, views]).toEqual([4, 4]));
    expect(calls.filter((call) => !call.key.startsWith("GET")).map((call) => [call.key, call.body])).toEqual([
      [
        "POST /v1/demand",
        {
          source: "pipeline",
          prospect_name: "Acme Corp",
          month: "2026-12",
          hours: 200,
          probability: 0.5,
          role: "architect",
          note: "Two pursuits closing",
        },
      ],
      [`DELETE /v1/demand/${DEMAND_ID}`, undefined],
      ["POST /v1/demand/import", { content }],
    ]);
    list.unsubscribe();
    view.unsubscribe();
  });

  it("leaves the list alone when an import is refused, so the problems stay on screen", async () => {
    let lists = 0;
    stubFetch({
      "GET /v1/demand": () => {
        lists += 1;
        return json(aDemandList());
      },
      "POST /v1/demand/import": () =>
        json({ code: "invalid_import", problems: [{ line: 2, problem: 'month must be YYYY-MM, got "2026-13"' }] }, 400),
    });
    const store = makeStore();
    const list = store.dispatch(capacityApi.endpoints.listDemand.initiate({ from: "2026-12" }));
    await list.unwrap();
    await expect(
      store
        .dispatch(capacityApi.endpoints.importDemand.initiate({ content: "source,month,hours\npipeline,2026-13,10" }))
        .unwrap(),
    ).rejects.toMatchObject({ status: 400, data: { code: "invalid_import" } });
    expect(lists).toBe(1);
    list.unsubscribe();
  });

  it("reloads the view after PTO is entered and after cells are written, even when the write is refused as stale", async () => {
    let views = 0;
    stubFetch({
      "GET /v1/capacity": () => {
        views += 1;
        return json(aCapacityView());
      },
      [`POST /v1/roster/people/${PERSON_ID}/pto`]: () => json(aPto(), 201),
      "PUT /v1/allocations": () => json({ code: "stale_version", entity: "allocation", current: 3 }, 409),
    });
    const store = makeStore();
    const subscription = store.dispatch(capacityApi.endpoints.capacityView.initiate({ month: "2026-09" }));
    await subscription.unwrap();
    await store
      .dispatch(
        capacityApi.endpoints.addPto.initiate({
          personId: PERSON_ID,
          body: { starts_on: "2026-09-21", ends_on: "2026-09-21", kind: "other" },
        }),
      )
      .unwrap();
    await vi.waitFor(() => expect(views).toBe(2));
    await expect(
      store
        .dispatch(
          capacityApi.endpoints.putAllocations.initiate({
            cells: [
              { person_id: PERSON_ID, account_id: ACCOUNT_ID, month: "2026-09-01", planned_minutes: 60, version: 1 },
            ],
          }),
        )
        .unwrap(),
    ).rejects.toMatchObject({ status: 409, data: { code: "stale_version", current: 3 } });
    await vi.waitFor(() => expect(views).toBe(3));
    subscription.unsubscribe();
  });
});
