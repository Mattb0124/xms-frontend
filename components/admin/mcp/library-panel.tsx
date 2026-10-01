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
  describeSaveRefusal,
  headersFromText,
  headersToText,
  libraryOf,
  problemsWith,
  serverAddress,
  serverFromDraft,
  withoutServer,
  withServer,
  type McpLibraryBody,
  type McpServerDefinition,
} from "@/lib/admin/mcp-library";
import { useActivateConfigVersionMutation, useCreateConfigVersionMutation, useGetConfigQuery } from "@/redux/adminApi";

const BLANK: McpServerDefinition = { slug: "", name: "", transport: "streamable_http", url: "", secret_ref: null };

/** The connection open in the form, its header lines as typed, and the writes behind Save and Remove. */
function useLibraryEditor(catalog: McpLibraryBody) {
  const [createVersion, creating] = useCreateConfigVersionMutation();
  const [activate, activating] = useActivateConfigVersionMutation();
  const [editing, setEditing] = useState<McpServerDefinition | null>(null);
  const [originalSlug, setOriginalSlug] = useState<string | null>(null);
  const [headerText, setHeaderText] = useState("");
  const [problem, setProblem] = useState<string | null>(null);

  const others = (catalog.servers ?? []).filter((server) => server.slug !== originalSlug);
  const problems = editing ? problemsWith({ ...editing, headers: headersFromText(headerText) }, others) : {};

  /** Writes the whole catalog as a new active version. */
  async function publish(body: McpLibraryBody) {
    setProblem(null);
    try {
      const draft = await createVersion({ kind: "mcp", body: body as Record<string, unknown> }).unwrap();
      await activate({ kind: "mcp", id: draft.id }).unwrap();
      setEditing(null);
      setOriginalSlug(null);
    } catch (caught) {
      setProblem(describeSaveRefusal(caught));
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
    await publish(withServer(catalog, serverFromDraft(editing, headerText), originalSlug));
  }

  return {
    editing,
    setEditing,
    originalSlug,
    headerText,
    setHeaderText,
    problem,
    problems,
    busy: creating.isLoading || activating.isLoading,
    open,
    commit,
    remove: (slug: string) => publish(withoutServer(catalog, slug)),
  };
}

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
  const catalog = useMemo(() => libraryOf(library.data?.active?.body), [library.data]);
  const editor = useLibraryEditor(catalog);
  const servers = catalog.servers ?? [];

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
          <button type="button" className={PRIMARY_BUTTON} onClick={() => editor.open(null)} disabled={editor.busy}>
            Add a connection
          </button>
        }
      >
        {servers.length === 0 ? (
          <p className="text-xms-label text-body">No connections yet.</p>
        ) : (
          <div data-mcp-library>
            {servers.map((server) => (
              <div key={server.slug} className="border-xms-line flex items-center gap-3 border-b py-3 last:border-b-0">
                <div className="min-w-0">
                  <p className="text-xms-ink text-body font-medium">{server.name}</p>
                  <p className="text-xms-label truncate text-body">{serverAddress(server)}</p>
                </div>
                <div className="ml-auto flex shrink-0 items-center gap-2">
                  {server.caller_token ? <span className="text-xms-label text-body">caller token</span> : null}
                  {server.secret_ref ? <span className="text-xms-label text-body">{server.secret_ref}</span> : null}
                  <button
                    type="button"
                    className={SECONDARY_BUTTON}
                    onClick={() => editor.open(server)}
                    disabled={editor.busy}
                  >
                    Edit
                  </button>
                  <ConfirmButton
                    label="Remove"
                    confirmLabel="Remove for every account?"
                    danger
                    disabled={editor.busy}
                    onConfirm={() => editor.remove(server.slug)}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        <InlineError message={editor.problem} />
      </Panel>

      {editor.editing ? (
        <ServerForm
          title={editor.originalSlug ? `Edit ${editor.originalSlug}` : "Add a connection"}
          draft={editor.editing}
          headerText={editor.headerText}
          problems={editor.problems}
          busy={editor.busy}
          onChange={editor.setEditing}
          onHeadersChange={editor.setHeaderText}
          onSave={editor.commit}
          onCancel={() => editor.setEditing(null)}
        />
      ) : null}
    </div>
  );
}

export interface ServerFormProps {
  title: string;
  draft: McpServerDefinition;
  headerText: string;
  problems: Record<string, string>;
  busy: boolean;
  onChange: (draft: McpServerDefinition) => void;
  onHeadersChange: (text: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

function ServerForm({
  title,
  draft,
  headerText,
  problems,
  busy,
  onChange,
  onHeadersChange,
  onSave,
  onCancel,
}: ServerFormProps) {
  const set = (patch: Partial<McpServerDefinition>) => onChange({ ...draft, ...patch });

  return (
    <Panel title={title}>
      <div className="flex flex-col gap-3">
        <FieldRow label="Name" htmlFor="mcp-name">
          <input
            id="mcp-name"
            className={INPUT}
            value={draft.name}
            onChange={(event) => set({ name: event.target.value })}
          />
        </FieldRow>
        <InlineError message={problems.name ?? null} />

        <FieldRow label="Slug" htmlFor="mcp-slug">
          <input
            id="mcp-slug"
            className={INPUT}
            value={draft.slug}
            onChange={(event) => set({ slug: event.target.value })}
          />
        </FieldRow>
        <InlineError message={problems.slug ?? null} />

        <FieldRow label="Transport" htmlFor="mcp-transport">
          <select
            id="mcp-transport"
            className={INPUT}
            value={draft.transport}
            onChange={(event) => set({ transport: event.target.value as McpServerDefinition["transport"] })}
          >
            <option value="streamable_http">Streamable HTTP</option>
            <option value="stdio">stdio</option>
          </select>
        </FieldRow>

        {draft.transport === "streamable_http" ? (
          <>
            <FieldRow label="URL" htmlFor="mcp-url">
              <input
                id="mcp-url"
                className={INPUT}
                value={draft.url ?? ""}
                onChange={(event) => set({ url: event.target.value })}
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
                value={draft.command ?? ""}
                onChange={(event) => set({ command: event.target.value })}
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
            onChange={(event) => onHeadersChange(event.target.value)}
          />
        </FieldRow>
        <InlineError message={problems.headers ?? null} />

        <FieldRow label="Secret reference" htmlFor="mcp-secret">
          <input
            id="mcp-secret"
            className={INPUT}
            placeholder="xms/dev/mcp/onestream-brk"
            value={draft.secret_ref ?? ""}
            onChange={(event) => set({ secret_ref: event.target.value })}
          />
        </FieldRow>

        <SwitchRow
          id="mcp-caller-token"
          label="Authorize with the caller's own token"
          detail="For a connection XMS serves itself"
          checked={Boolean(draft.caller_token)}
          onChange={(next) => set({ caller_token: next })}
        />

        <p className="text-xms-label text-body">
          Never type a credential here. A configuration body is versioned and shows in the audit trail, so name the
          secret above and leave a placeholder in the header.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={PRIMARY_BUTTON}
            onClick={onSave}
            disabled={busy || Object.keys(problems).length > 0}
          >
            Save and activate
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </Panel>
  );
}
