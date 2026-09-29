import { fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AccountMcpPanel } from "@/components/admin/mcp/account-mcp-panel";
import { McpLibraryPanel } from "@/components/admin/mcp/library-panel";
import { json, renderDesk, stubFetch } from "@/test-kit/desk";

const ACCOUNT_ID = "8b1f0a1e-9a2c-4a1e-9f1a-1c2d3e4f5a6b";
const ACCOUNT_CONFIG = `GET /v1/accounts/${ACCOUNT_ID}/config/mcp`;
const ACCOUNT_OVERRIDE = `PUT /v1/accounts/${ACCOUNT_ID}/config/mcp/override`;
const LIBRARY = "GET /v1/admin/config/mcp";
const NEW_VERSION = "POST /v1/admin/config/mcp/versions";
const ACTIVATE = "POST /v1/admin/config/mcp/versions/v2/activate";

const XMS = {
  slug: "xms",
  name: "XMS",
  transport: "streamable_http",
  url: "https://xms-mcp.dev.example/mcp",
  caller_token: true,
  secret_ref: null,
};
const ONESTREAM = {
  slug: "onestream-brk",
  name: "OneStream (Brookfield)",
  transport: "streamable_http",
  url: "https://onestream.brk.example/mcp",
  secret_ref: "xms/dev/mcp/onestream-brk",
};

/** The operator library as the describe route answers it. */
const library = (servers: unknown[] = [XMS, ONESTREAM], enabled: string[] = ["xms"]) => ({
  active: { id: "v1", kind: "mcp", scope_key: "*", version: 1, body: { servers, enabled }, status: "active" },
  versions: [],
});

/** One account's view: an override when it has chosen, the default when it has not. */
const forAccount = (enabled?: string[]) => ({
  kind: "mcp",
  effective: enabled
    ? { source: "override", body: { enabled }, version: 1 }
    : { source: "default", body: library().active.body, version: 1 },
  default: library().active,
  overrides: [],
});

const draft = { id: "v2", kind: "mcp", scope_key: "*", version: 2, body: {}, status: "draft" };

describe("the MCP connections an account gets", () => {
  it("shows the library with the account's own selection ticked", async () => {
    stubFetch({
      [LIBRARY]: () => json(library()),
      [ACCOUNT_CONFIG]: () => json(forAccount(["onestream-brk"])),
    });
    renderDesk(<AccountMcpPanel accountId={ACCOUNT_ID} />);

    await screen.findByText("OneStream (Brookfield)");
    expect(screen.getByRole("switch", { name: /OneStream/ })).toBeChecked();
    expect(screen.getByRole("switch", { name: /XMS/ })).not.toBeChecked();
    expect(screen.getByText("This account has its own selection.")).toBeInTheDocument();
  });

  /**
   * Following the default is a real state, not an empty one, so it is said
   * rather than shown as nothing selected.
   */
  it("says so when the account is following the operator default", async () => {
    stubFetch({ [LIBRARY]: () => json(library()), [ACCOUNT_CONFIG]: () => json(forAccount()) });
    renderDesk(<AccountMcpPanel accountId={ACCOUNT_ID} />);

    await screen.findByText(/Following the operator default/);
    expect(screen.getByRole("switch", { name: /XMS/ })).toBeChecked();
  });

  it("writes only the choice, never the connection definitions", async () => {
    const sent = stubFetch({
      [LIBRARY]: () => json(library()),
      [ACCOUNT_CONFIG]: () => json(forAccount(["xms"])),
      [ACCOUNT_OVERRIDE]: () => json({ id: "o1", version: 2 }),
    });
    renderDesk(<AccountMcpPanel accountId={ACCOUNT_ID} />);

    fireEvent.click(await screen.findByRole("switch", { name: /OneStream/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save selection" }));

    await waitFor(() => {
      const put = sent.find((call) => call.key === ACCOUNT_OVERRIDE);
      expect(put?.body).toEqual({ body: { enabled: ["xms", "onestream-brk"] } });
    });
  });

  it("names a connection the library has retired rather than hiding it", async () => {
    stubFetch({
      [LIBRARY]: () => json(library([XMS], ["xms"])),
      [ACCOUNT_CONFIG]: () => json(forAccount(["xms", "sap-retired"])),
    });
    renderDesk(<AccountMcpPanel accountId={ACCOUNT_ID} />);

    expect(await screen.findByText(/still names sap-retired/)).toBeInTheDocument();
  });
});

describe("the MCP library", () => {
  it("lists the connections and what authorises each", async () => {
    stubFetch({ [LIBRARY]: () => json(library()) });
    renderDesk(<McpLibraryPanel />);

    await screen.findByText("XMS");
    expect(screen.getByText("caller token")).toBeInTheDocument();
    expect(screen.getByText("xms/dev/mcp/onestream-brk")).toBeInTheDocument();
  });

  /**
   * The whole point of the secret reference: a configuration body is versioned
   * and diffed into the audit trail, so a token typed here would be a token in
   * the audit trail. The server refuses one too; the form says so first.
   */
  it("refuses a literal credential in a header before the server is asked", async () => {
    const sent = stubFetch({ [LIBRARY]: () => json(library()) });
    renderDesk(<McpLibraryPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Add a connection" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "SAP" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "sap" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "https://sap.example/mcp" } });
    fireEvent.change(screen.getByLabelText("Headers"), {
      target: { value: "Authorization: Bearer sk_live_9f2b71c4ad" },
    });

    expect(screen.getByRole("alert")).toHaveTextContent(/must be a \$\{PLACEHOLDER\}/);
    expect(screen.getByRole("button", { name: "Save and activate" })).toBeDisabled();
    expect(sent.some((call) => call.key === NEW_VERSION)).toBe(false);
  });

  it("refuses a plain http address, because a tool call carries the token that authorises it", async () => {
    stubFetch({ [LIBRARY]: () => json(library()) });
    renderDesk(<McpLibraryPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Add a connection" }));
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "http://sap.example/mcp" } });

    expect(
      screen
        .getAllByRole("alert")
        .map((node) => node.textContent)
        .join(" "),
    ).toMatch(/https/);
  });

  it("adds a connection as a new version and switches it on", async () => {
    const sent = stubFetch({
      [LIBRARY]: () => json(library([XMS], ["xms"])),
      [NEW_VERSION]: () => json(draft),
      [ACTIVATE]: () => json({ ...draft, status: "active" }),
    });
    renderDesk(<McpLibraryPanel />);

    fireEvent.click(await screen.findByRole("button", { name: "Add a connection" }));
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "OneStream (Brookfield)" } });
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "onestream-brk" } });
    fireEvent.change(screen.getByLabelText("URL"), { target: { value: "https://onestream.brk.example/mcp" } });
    fireEvent.change(screen.getByLabelText("Secret reference"), { target: { value: "xms/dev/mcp/onestream-brk" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and activate" }));

    await waitFor(() => {
      const created = sent.find((call) => call.key === NEW_VERSION);
      const body = (created?.body as { body: { servers: { slug: string }[] } })?.body;
      expect(body?.servers.map((server) => server.slug)).toEqual(["xms", "onestream-brk"]);
    });
    // Written, then switched on: the server keeps every version and only one is
    // active, so an edit is two calls and the history shows both.
    await waitFor(() => expect(sent.some((call) => call.key === ACTIVATE)).toBe(true));
  });

  it("carries an account's choice across a rename, so a client does not lose a system quietly", async () => {
    const sent = stubFetch({
      [LIBRARY]: () => json(library([XMS, ONESTREAM], ["xms", "onestream-brk"])),
      [NEW_VERSION]: () => json(draft),
      [ACTIVATE]: () => json({ ...draft, status: "active" }),
    });
    renderDesk(<McpLibraryPanel />);

    fireEvent.click((await screen.findAllByRole("button", { name: "Edit" }))[1]!);
    fireEvent.change(screen.getByLabelText("Slug"), { target: { value: "onestream-brookfield" } });
    fireEvent.click(screen.getByRole("button", { name: "Save and activate" }));

    await waitFor(() => {
      const created = sent.find((call) => call.key === NEW_VERSION);
      expect((created?.body as { body: { enabled: string[] } })?.body.enabled).toEqual(["xms", "onestream-brookfield"]);
    });
  });
});
