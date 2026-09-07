import { afterEach, describe, expect, it, vi } from "vitest";
import { portalApi } from "@/redux/portalApi";
import { makeStore } from "@/redux/store";
import { aPortalMe, aPortalTicket, json, stubFetch } from "@/test-kit/portal";

/** The portal slice sends exactly the request shapes the /v1/portal contract expects. */
describe("portalApi", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads me, lists with scope and q, and reads a ticket by key", async () => {
    const calls = stubFetch({
      "GET /v1/portal/me": () => json(aPortalMe()),
      "GET /v1/portal/tickets": () => json({ items: [aPortalTicket()], next_cursor: null }),
      "GET /v1/portal/tickets/CS0001001": () => json(aPortalTicket()),
    });
    const store = makeStore();
    const me = await store.dispatch(portalApi.endpoints.portalMe.initiate()).unwrap();
    expect(me.account?.name).toBe("Brookfield");
    await store.dispatch(portalApi.endpoints.portalTickets.initiate({ scope: "all", q: "report" })).unwrap();
    await store.dispatch(portalApi.endpoints.portalTicket.initiate("CS0001001")).unwrap();
    expect(calls.map((call) => `${call.key}${call.search}`)).toEqual([
      "GET /v1/portal/me",
      "GET /v1/portal/tickets?scope=all&q=report",
      "GET /v1/portal/tickets/CS0001001",
    ]);
  });

  it("posts a request, a comment and a transition with the version", async () => {
    const calls = stubFetch({
      "POST /v1/portal/tickets": () => json(aPortalTicket(), 201),
      "POST /v1/portal/tickets/CS0001001/comments": () =>
        json({ id: "c", body: "x", author_name: "Pat", source: "portal", created_at: "2026-09-07T10:00:00Z" }, 201),
      "POST /v1/portal/tickets/CS0001001/transitions": () => json(aPortalTicket({ state: "closed" }), 201),
    });
    const store = makeStore();
    await store
      .dispatch(
        portalApi.endpoints.createPortalTicket.initiate({
          type: "incident",
          short_description: "Broken",
          impact: "high",
        }),
      )
      .unwrap();
    await store
      .dispatch(portalApi.endpoints.addPortalComment.initiate({ key: "CS0001001", body: "Still broken" }))
      .unwrap();
    const closed = await store
      .dispatch(portalApi.endpoints.portalTransition.initiate({ key: "CS0001001", version: 3, to: "closed" }))
      .unwrap();
    expect(closed.state).toBe("closed");
    expect(calls.map((call) => call.body)).toEqual([
      { type: "incident", short_description: "Broken", impact: "high" },
      { body: "Still broken" },
      { version: 3, to: "closed" },
    ]);
  });

  it("returns an empty article list from the knowledge placeholder without a request", async () => {
    const calls = stubFetch({});
    const store = makeStore();
    const articles = await store.dispatch(portalApi.endpoints.searchArticles.initiate("cube")).unwrap();
    expect(articles).toEqual([]);
    expect(calls).toEqual([]);
  });
});
