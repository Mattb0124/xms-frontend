import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountConfigTab } from "@/components/admin/config/account-config-tab";
import {
  ACCOUNT_ID,
  aConfigVersion,
  aNothingActiveConfig,
  anAccountConfig,
  anOverride,
  anOverriddenConfig,
} from "@/test-kit/config";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

vi.mock("next/navigation", () => ({ usePathname: () => `/admin/accounts/${ACCOUNT_ID}` }));

const me = (permissions: string[]) => () =>
  json({ principal: { kind: "internal", userId: "u1", accountIds: [ACCOUNT_ID], permissions } });

const machine = { initial: "new", states: [{ key: "new", label: "New", kind: "intake" }], transitions: [] };

/** Every catalog answers with the default in force; the state machine carries the scope it was asked for. */
function catalogRoutes(overrides: Record<string, () => Response> = {}) {
  const defaults = Object.fromEntries(
    ["priority_matrix", "sla_policy", "activity_types", "billable_classes", "resolution_codes"].map((kind) => [
      `GET /v1/accounts/${ACCOUNT_ID}/config/${kind}`,
      () => json(anAccountConfig({ default: aConfigVersion({ kind: kind as never }) })),
    ]),
  );
  return {
    ...defaults,
    [`GET /v1/accounts/${ACCOUNT_ID}/config/state_machine`]: () =>
      json(
        anAccountConfig({ default: aConfigVersion({ kind: "state_machine", scope_key: "incident", body: machine }) }),
      ),
    ...overrides,
  };
}

function editor(): HTMLTextAreaElement {
  return screen.getByLabelText("Body") as HTMLTextAreaElement;
}

describe("AccountConfigTab", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fails closed without admin:config and never reads the catalogs", async () => {
    const calls = stubFetch({ "GET /v1/admin/me": me(["admin:accounts"]) });
    renderDesk(<AccountConfigTab accountId={ACCOUNT_ID} />);
    await screen.findByText(/Needs the admin:config permission/);
    expect(calls.some((call) => call.key.includes("/config/"))).toBe(false);
  });

  it("lists the six catalogs with their effective source, asks for the state machine with a scope, and switches scope", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:accounts", "admin:config"]),
      ...catalogRoutes({ [`GET /v1/accounts/${ACCOUNT_ID}/config/sla_policy`]: () => json(anOverriddenConfig()) }),
    });
    renderDesk(<AccountConfigTab accountId={ACCOUNT_ID} />);
    await screen.findByText("Override v2");
    await waitFor(() =>
      expect(within(screen.getByRole("list", { name: "Catalogs" })).getAllByText("Default v1")).toHaveLength(5),
    );
    const machineCalls = calls.filter((call) => call.key.endsWith("/config/state_machine"));
    expect(machineCalls.map((call) => call.search)).toEqual(["?scope=incident"]);
    expect(calls.find((call) => call.key.endsWith("/config/sla_policy"))?.search).toBe("");
    // The state machine is selected first; its editor shows the incident body and the scope selector.
    expect(editor().value).toContain('"initial": "new"');
    fireEvent.change(screen.getByLabelText("Scope"), { target: { value: "change" } });
    await waitFor(() =>
      expect(calls.filter((call) => call.key.endsWith("/config/state_machine")).map((call) => call.search)).toEqual([
        "?scope=incident",
        "?scope=change",
      ]),
    );
    expect(screen.queryByLabelText("Scope")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Priority matrix/ }));
    await waitFor(() => expect(screen.queryByLabelText("Scope")).not.toBeInTheDocument());
  });

  it("refuses text that is not a JSON object before sending, then sends { body } and shows invalid_config problems", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:config"]),
      ...catalogRoutes(),
      [`PUT /v1/accounts/${ACCOUNT_ID}/config/sla_policy/override`]: () =>
        json({ code: "invalid_config", problems: ["targets.incident.p1.response_minutes must be a number"] }, 400),
    });
    renderDesk(<AccountConfigTab accountId={ACCOUNT_ID} />);
    await screen.findAllByText("Default v1");
    fireEvent.click(screen.getByRole("button", { name: /SLA policy/ }));
    await waitFor(() => expect(editor().value).toContain('"calendar": "24x7"'));
    const save = screen.getByRole("button", { name: "Save as override" });
    fireEvent.change(editor(), { target: { value: "{ not json" } });
    expect(screen.getByRole("alert")).toHaveTextContent(/^Not valid JSON/);
    expect(save).toBeDisabled();
    fireEvent.change(editor(), { target: { value: "[1, 2]" } });
    expect(screen.getByRole("alert")).toHaveTextContent("The body must be a JSON object.");
    fireEvent.change(editor(), {
      target: { value: '{"calendar":"24x7","targets":{"incident":{"p1":{"response_minutes":"soon"}}}}' },
    });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await screen.findByText("targets.incident.p1.response_minutes must be a number");
    expect(calls.find((call) => call.key.startsWith("PUT "))?.body).toEqual({
      body: { calendar: "24x7", targets: { incident: { p1: { response_minutes: "soon" } } } },
    });
    expect(calls.find((call) => call.key.startsWith("PUT "))?.search).toBe("");
  });

  it("saves an override for a scoped kind with the scope, then reloads the editor from the new effective version", async () => {
    let saved = false;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:config"]),
      ...catalogRoutes({
        [`GET /v1/accounts/${ACCOUNT_ID}/config/state_machine`]: () =>
          saved
            ? json({
                effective: {
                  source: "override",
                  version: 1,
                  versionId: "ov-1",
                  body: { ...machine, initial: "assigned" },
                },
                default: aConfigVersion({ kind: "state_machine", scope_key: "incident", body: machine }),
                overrides: [
                  anOverride({
                    id: "ov-1",
                    kind: "state_machine",
                    scope_key: "incident",
                    body: { ...machine, initial: "assigned" },
                  }),
                ],
              })
            : json(
                anAccountConfig({
                  default: aConfigVersion({ kind: "state_machine", scope_key: "incident", body: machine }),
                }),
              ),
      }),
      [`PUT /v1/accounts/${ACCOUNT_ID}/config/state_machine/override`]: () => {
        saved = true;
        return json(anOverride({ id: "ov-1", kind: "state_machine", scope_key: "incident" }));
      },
    });
    renderDesk(<AccountConfigTab accountId={ACCOUNT_ID} />);
    await waitFor(() => expect(editor().value).toContain('"initial": "new"'));
    fireEvent.change(editor(), { target: { value: JSON.stringify({ ...machine, initial: "assigned" }) } });
    fireEvent.click(screen.getByRole("button", { name: "Save as override" }));
    await screen.findByText("Version 1 is active for this account.");
    const put = calls.find((call) => call.key.startsWith("PUT "));
    expect(put?.search).toBe("?scope=incident");
    expect(put?.body).toEqual({ body: { ...machine, initial: "assigned" } });
    // Once in the catalog row, once in the editor header.
    await waitFor(() => expect(screen.getAllByText("Override v1")).toHaveLength(2));
    await waitFor(() => expect(editor().value).toContain('"initial": "assigned"'));
    expect(screen.getByRole("button", { name: "Save as new override version" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove override" })).toBeInTheDocument();
  });

  it("removes an active override with a confirm, shows the history and the default body, and words a second removal", async () => {
    let removed = false;
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:config"]),
      ...catalogRoutes({
        [`GET /v1/accounts/${ACCOUNT_ID}/config/sla_policy`]: () =>
          removed
            ? json(
                anAccountConfig({
                  overrides: anOverriddenConfig().overrides.map((row) => ({ ...row, status: "retired" as const })),
                }),
              )
            : json(anOverriddenConfig()),
      }),
      [`DELETE /v1/accounts/${ACCOUNT_ID}/config/sla_policy/override`]: () => {
        if (removed) return json({ code: "not_found", entity: "config_override" }, 404);
        removed = true;
        return json({ removed: "cfg-override-2" });
      },
    });
    renderDesk(<AccountConfigTab accountId={ACCOUNT_ID} />);
    await screen.findByText("Override v2");
    fireEvent.click(screen.getByRole("button", { name: /SLA policy/ }));
    await waitFor(() => expect(editor().value).toContain('"response_minutes": 15'));
    const history = screen.getByLabelText("Override versions");
    expect(history.querySelector("[data-override-version='2']")).toHaveTextContent("active");
    expect(history.querySelector("[data-override-version='1']")).toHaveTextContent("retired");
    expect(screen.getByText("Show the operator default body")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove override" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm remove override" }));
    await screen.findByText("The operator default applies to this account again.");
    expect(calls.filter((call) => call.key.startsWith("DELETE ")).map((call) => call.search)).toEqual([""]);
    await waitFor(() => expect(editor().value).toContain('"response_minutes": 30'));
    expect(screen.queryByRole("button", { name: "Remove override" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save as override" })).toBeInTheDocument();
  });

  it("states that nothing is active for a kind, keeps the editor usable, and lists the SLA policy's invalid_config problems", async () => {
    const calls = stubFetch({
      "GET /v1/admin/me": me(["admin:config"]),
      ...catalogRoutes({ [`GET /v1/accounts/${ACCOUNT_ID}/config/sla_policy`]: () => json(aNothingActiveConfig()) }),
      [`PUT /v1/accounts/${ACCOUNT_ID}/config/sla_policy/override`]: () =>
        json(
          {
            code: "invalid_config",
            problems: ["calendar must be one of 24x7, business_hours", "targets.incident is required"],
          },
          400,
        ),
    });
    renderDesk(<AccountConfigTab accountId={ACCOUNT_ID} />);
    await screen.findAllByText("Default v1");
    const row = screen.getByRole("button", { name: /SLA policy/ });
    expect(within(row).getByText("Nothing active")).toHaveAttribute("data-state", "needs-input");
    fireEvent.click(row);
    await screen.findByRole("status");
    expect(screen.getByRole("status")).toHaveTextContent("Nothing active for this kind.");
    expect(screen.getAllByText("Nothing active")).toHaveLength(2);
    expect(editor().value).toBe("{}");
    expect(screen.getByText("No operator default is active. Run the seed.")).toBeInTheDocument();
    expect(screen.getByText("No override yet. The operator default applies.")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save as override" });
    expect(save).toBeEnabled();
    fireEvent.change(editor(), { target: { value: '{"calendar":"weekends"}' } });
    fireEvent.click(save);
    await screen.findByText("calendar must be one of 24x7, business_hours");
    expect(screen.getByText("targets.incident is required")).toBeInTheDocument();
    expect(calls.find((call) => call.key.startsWith("PUT "))?.body).toEqual({ body: { calendar: "weekends" } });
  });
});
