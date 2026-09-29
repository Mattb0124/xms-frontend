"use client";

import { useMemo, useState } from "react";
import { ConfirmButton, InlineError, PRIMARY_BUTTON, SECONDARY_BUTTON, SwitchRow } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { enabledSlugs, libraryOf, retiredSlugs } from "@/lib/admin/mcp-library";
import {
  useGetAccountConfigQuery,
  useGetConfigQuery,
  useRemoveAccountOverrideMutation,
  useSetAccountOverrideMutation,
} from "@/redux/adminApi";

/**
 * Which MCP connections this client gets (AI Integration section 4).
 *
 * The operator keeps one library and each account is given a subset of it, so
 * Axel working a Brookfield ticket reaches Brookfield's systems and nobody
 * else's. The catalog is read from the operator default and only the choice is
 * written here, which is why saving sends `{ enabled: [...] }` and never the
 * connection definitions: an account that restated them would hold a copy that
 * stops matching the library the moment somebody edits an entry.
 *
 * An account that has never chosen follows the operator's own list. That is a
 * real state rather than an empty one, so it is said in words rather than shown
 * as nothing selected.
 */
export function AccountMcpPanel({ accountId }: { accountId: string }) {
  const library = useGetConfigQuery({ kind: "mcp" });
  const account = useGetAccountConfigQuery({ accountId, kind: "mcp" });
  const [save, saving] = useSetAccountOverrideMutation();
  const [clear, clearing] = useRemoveAccountOverrideMutation();
  const [draft, setDraft] = useState<string[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const catalog = useMemo(() => libraryOf(library.data?.active?.body), [library.data]);
  const override = account.data?.effective?.source === "override" ? libraryOf(account.data.effective.body) : null;
  const chosen = draft ?? enabledSlugs(catalog, override);
  const retired = retiredSlugs(catalog, chosen);
  const busy = saving.isLoading || clearing.isLoading;
  const dirty = draft !== null;

  function toggle(slug: string, on: boolean) {
    const next = new Set(chosen);
    if (on) next.add(slug);
    else next.delete(slug);
    // Order follows the catalog so two accounts with the same connections
    // write the same list, which keeps the audit diff about what changed.
    setDraft((catalog.servers ?? []).map((server) => server.slug).filter((slug2) => next.has(slug2)));
    setProblem(null);
  }

  async function commit() {
    setProblem(null);
    try {
      await save({ accountId, kind: "mcp", body: { enabled: chosen } }).unwrap();
      setDraft(null);
    } catch (caught) {
      const detail = (caught as { data?: { problems?: string[] } })?.data?.problems?.join("; ");
      setProblem(detail ?? "That could not be saved.");
    }
  }

  async function follow() {
    setProblem(null);
    try {
      await clear({ accountId, kind: "mcp" }).unwrap();
      setDraft(null);
    } catch {
      setProblem("That could not be removed.");
    }
  }

  if (library.isLoading || account.isLoading) {
    return (
      <Panel title="MCP connections">
        <Skeleton lines={3} />
      </Panel>
    );
  }

  const servers = catalog.servers ?? [];
  return (
    <Panel
      title="MCP connections"
      subtitle={
        override
          ? "This account has its own selection."
          : "Following the operator default. Changing anything here gives this account its own selection."
      }
    >
      {servers.length === 0 ? (
        <p className="text-xms-label text-body">
          The library has no connections yet. Add one under Admin, MCP library.
        </p>
      ) : (
        <div data-mcp-account-list>
          {servers.map((server) => (
            <SwitchRow
              key={server.slug}
              id={`mcp-${server.slug}`}
              label={server.name}
              detail={server.transport === "streamable_http" ? server.url : server.command}
              checked={chosen.includes(server.slug)}
              onChange={(next) => toggle(server.slug, next)}
              disabled={busy}
            />
          ))}
        </div>
      )}

      {retired.length > 0 ? (
        <p className="text-xms-label mt-3 text-body" data-mcp-retired>
          This account still names {retired.join(", ")}, which the library no longer defines. It is ignored, and saving
          drops it.
        </p>
      ) : null}

      <InlineError message={problem} />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" className={PRIMARY_BUTTON} onClick={commit} disabled={!dirty || busy}>
          Save selection
        </button>
        {dirty ? (
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setDraft(null)} disabled={busy}>
            Discard
          </button>
        ) : null}
        {override ? (
          <ConfirmButton label="Follow the default" confirmLabel="Remove this selection?" onConfirm={follow} />
        ) : null}
      </div>
    </Panel>
  );
}
