"use client";

import { useMemo, useState } from "react";
import {
  ConfirmButton,
  FieldRow,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  SwitchRow,
} from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import {
  headersFromText,
  headersToText,
  libraryOf,
  problemsWith,
  type McpLibraryBody,
  type McpServerDefinition,
} from "@/lib/admin/mcp-library";
import { useActivateConfigVersionMutation, useCreateConfigVersionMutation, useGetConfigQuery } from "@/redux/adminApi";

const BLANK: McpServerDefinition = { slug: "", name: "", transport: "streamable_http", url: "", secret_ref: null };

/**
 * The operator's library of MCP connections (AI Integration section 4, ADR-19).
 *
 * Every client's Axel reaches the systems that client runs, so the operator
 * keeps the catalog here and turns entries on per account from the account's
 * own record. This screen is the catalog half: what connections exist at all.
 *
 * Saving writes a new version and switches it on, which is two calls because
 * the server keeps every version and only one is active. That is worth the
 * round trip: a bad edit is one activation away from being undone, and the
 * version history on the Configuration screen shows who changed what.
 *
 * **No credential is typed here.** A header whose name looks like a credential
 * may only carry a `${PLACEHOLDER}`; the secret itself is named under Secret
 * reference and lives in Secrets Manager. The server refuses a literal too, but
 * the form says so first, because a person who has pasted a token wants to know
 * before they press save rather than after.
 */
export function McpLibraryPanel() {
  const library = useGetConfigQuery({ kind: "mcp" });
  const [createVersion, creating] = useCreateConfigVersionMutation();
  const [activate, activating] = useActivateConfigVersionMutation();
  const [editing, setEditing] = useState<McpServerDefinition | null>(null);
  const [originalSlug, setOriginalSlug] = useState<string | null>(null);
  const [headerText, setHeaderText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const catalog = useMemo(() => libraryOf(library.data?.active?.body), [library.data]);
  const servers = catalog.servers ?? [];
  const busy = creating.isLoading || activating.isLoading;
  const others = servers.filter((server) => server.slug !== originalSlug);
  const problems = editing ? problemsWith({ ...editing, headers: headersFromText(headerText) }, others) : {};

  /** Writes the whole catalog as a new active version. */
  async function publish(next: McpServerDefinition[], enabled?: string[]) {
    setProblem(null);
    const body: McpLibraryBody = { servers: next, enabled: enabled ?? catalog.enabled ?? [] };
    try {
      const draft = await createVersion({ kind: "mcp", body: body as Record<string, unknown> }).unwrap();
      await activate({ kind: "mcp", id: draft.id }).unwrap();
      setEditing(null);
      setOriginalSlug(null);
    } catch (caught) {
      const detail = (caught as { data?: { problems?: string[] } })?.data?.problems?.join("; ");
      setProblem(detail ?? "That could not be saved.");
    }
  }

  function open(server: McpServerDefinition | null) {
    const draft = server ?? BLANK;
    setEditing({ ...draft });
    setOriginalSlug(server?.slug ?? null);
    setHeaderText(headersToText(draft.headers));
    setProblem(null);
  }

  async function commit() {
    if (!editing || Object.keys(problems).length > 0) return;
    const headers = headersFromText(headerText);
    const saved: McpServerDefinition = {
      ...editing,
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      secret_ref: editing.secret_ref?.trim() ? editing.secret_ref.trim() : null,
    };
    const next = originalSlug
      ? servers.map((server) => (server.slug === originalSlug ? saved : server))
      : [...servers, saved];
    // Renaming a connection carries its enabled state across, so an account
    // does not silently lose a system because the slug was corrected.
    const enabled = (catalog.enabled ?? []).map((slug) => (slug === originalSlug ? saved.slug : slug));
    await publish(next, enabled);
  }

  async function remove(slug: string) {
    await publish(
      servers.filter((server) => server.slug !== slug),
      (catalog.enabled ?? []).filter((entry) => entry !== slug),
    );
  }

  if (library.isLoading) {
    return (
      <Panel title="MCP library">
        <Skeleton lines={4} />
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel
        title="MCP library"
        subtitle="The connections XMS knows about. Turn them on for a client from that account's record."
        actions={
          <button type="button" className={PRIMARY_BUTTON} onClick={() => open(null)} disabled={busy}>
            Add a connection
          </button>
        }
      >
        {servers.length === 0 ? (
          <p className="text-xms-label text-[14px]">No connections yet.</p>
        ) : (
          <div data-mcp-library>
            {servers.map((server) => (
              <div key={server.slug} className="border-xms-line flex items-center gap-3 border-b py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-xms-ink text-[14px] font-medium">{server.name}</p>
                  <p className="text-xms-label truncate text-[14px]">
                    {server.transport === "streamable_http" ? server.url : server.command}
                  </p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {server.caller_token ? <span className="text-xms-label text-[14px]">caller token</span> : null}
                  {server.secret_ref ? <span className="text-xms-label text-[14px]">{server.secret_ref}</span> : null}
                  <button type="button" className={SECONDARY_BUTTON} onClick={() => open(server)} disabled={busy}>
                    Edit
                  </button>
                  <ConfirmButton
                    label="Remove"
                    confirmLabel="Remove for every account?"
                    danger
                    disabled={busy}
                    onConfirm={() => remove(server.slug)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <InlineError message={problem} />
      </Panel>

      {editing ? (
        <Panel title={originalSlug ? `Edit ${originalSlug}` : "Add a connection"}>
          <div className="flex flex-col gap-3">
            <FieldRow label="Name" htmlFor="mcp-name">
              <input
                id="mcp-name"
                className={INPUT}
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </FieldRow>
            <InlineError message={problems.name ?? null} />

            <FieldRow label="Slug" htmlFor="mcp-slug">
              <input
                id="mcp-slug"
                className={INPUT}
                value={editing.slug}
                onChange={(event) => setEditing({ ...editing, slug: event.target.value })}
              />
            </FieldRow>
            <InlineError message={problems.slug ?? null} />

            <FieldRow label="Transport" htmlFor="mcp-transport">
              <select
                id="mcp-transport"
                className={INPUT}
                value={editing.transport}
                onChange={(event) =>
                  setEditing({ ...editing, transport: event.target.value as McpServerDefinition["transport"] })
                }
              >
                <option value="streamable_http">Streamable HTTP</option>
                <option value="stdio">stdio</option>
              </select>
            </FieldRow>

            {editing.transport === "streamable_http" ? (
              <>
                <FieldRow label="URL" htmlFor="mcp-url">
                  <input
                    id="mcp-url"
                    className={INPUT}
                    value={editing.url ?? ""}
                    onChange={(event) => setEditing({ ...editing, url: event.target.value })}
                  />
                </FieldRow>
                <InlineError message={problems.url ?? null} />
              </>
            ) : (
              <>
                <FieldRow label="Command" htmlFor="mcp-command">
                  <input
                    id="mcp-command"
                    className={INPUT}
                    value={editing.command ?? ""}
                    onChange={(event) => setEditing({ ...editing, command: event.target.value })}
                  />
                </FieldRow>
                <InlineError message={problems.command ?? null} />
              </>
            )}

            <FieldRow label="Headers" htmlFor="mcp-headers">
              <textarea
                id="mcp-headers"
                className={INPUT}
                rows={3}
                placeholder={"Authorization: ${ONESTREAM_TOKEN}\nX-Account: BRK"}
                value={headerText}
                onChange={(event) => setHeaderText(event.target.value)}
              />
            </FieldRow>
            <InlineError message={problems.headers ?? null} />

            <FieldRow label="Secret reference" htmlFor="mcp-secret">
              <input
                id="mcp-secret"
                className={INPUT}
                placeholder="xms/dev/mcp/onestream-brk"
                value={editing.secret_ref ?? ""}
                onChange={(event) => setEditing({ ...editing, secret_ref: event.target.value })}
              />
            </FieldRow>

            <SwitchRow
              id="mcp-caller-token"
              label="Authorize with the caller's own token"
              detail="For a connection XMS serves itself"
              checked={Boolean(editing.caller_token)}
              onChange={(next) => setEditing({ ...editing, caller_token: next })}
            />

            <p className="text-xms-label text-[14px]">
              Never type a credential here. A configuration body is versioned and shows in the audit trail, so name the
              secret above and leave a placeholder in the header.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={PRIMARY_BUTTON}
                onClick={commit}
                disabled={busy || Object.keys(problems).length > 0}
              >
                Save and activate
              </button>
              <button type="button" className={SECONDARY_BUTTON} onClick={() => setEditing(null)} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
