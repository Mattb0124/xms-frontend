"use client";

import { useMemo, useState } from "react";
import {
  ConfirmButton,
  INPUT,
  InlineError,
  PRIMARY_BUTTON,
  SECONDARY_BUTTON,
  formatDate,
} from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { catalogKind, formatBody, parseBody } from "@/lib/admin/config-catalog";
import { configError, describeConfigError } from "@/lib/admin/config-errors";
import { useTrack } from "@/lib/telemetry/provider";
import { cn } from "@/lib/utils";
import {
  useGetAccountConfigQuery,
  useRemoveAccountOverrideMutation,
  useSetAccountOverrideMutation,
  type AccountConfigView,
  type ConfigKind,
  type ConfigVersion,
} from "@/redux/adminApi";

/** Where the effective body comes from, with its version: "Default v1" or "Override v2". */
export function EffectiveSourcePill({ source, version }: { source: "default" | "override"; version: number }) {
  return (
    <SignalPill
      tone={source === "override" ? "ready" : "blocked"}
      label={`${source === "override" ? "Override" : "Default"} v${version}`}
    />
  );
}

/** The pill for a kind with nothing active: no operator default and no override resolve for the account. */
export function NothingActivePill() {
  return <SignalPill tone="needs-input" label="Nothing active" />;
}

/** The effective pill or the nothing-active one, from the view. */
export function EffectivePill({ view }: { view: AccountConfigView }) {
  return view.effective ? (
    <EffectiveSourcePill source={view.effective.source} version={view.effective.version} />
  ) : (
    <NothingActivePill />
  );
}

function VersionStatusPill({ status }: { status: ConfigVersion["status"] }) {
  const tone = status === "active" ? "complete" : status === "draft" ? "needs-input" : "blocked";
  return <SignalPill tone={tone} label={status} />;
}

interface BodyEditorProps {
  accountId: string;
  kind: ConfigKind;
  scope?: string;
  view: AccountConfigView;
  refetch: () => unknown;
}

/**
 * The body editor for one (kind, scope): the effective body as JSON text,
 * parsed client-side before anything is sent, saved as `{ body }`; the
 * server's `invalid_config` problems are listed in its words. Remounted by
 * its parent whenever the effective version changes, so the text always
 * starts from what resolves today.
 */
function BodyEditor({ accountId, kind, scope, view, refetch }: BodyEditorProps) {
  // With nothing active the editor starts from an empty object so a first override can be written.
  const initialText = formatBody(view.effective ? view.effective.body : {});
  const [text, setText] = useState(initialText);
  const [problems, setProblems] = useState<string[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [save, saveState] = useSetAccountOverrideMutation();
  const [remove, removeState] = useRemoveAccountOverrideMutation();
  const { push } = useToast();
  const trackSave = useTrack("config.override.save");
  const trackRemove = useTrack("config.override.remove");
  const parsed = useMemo(() => parseBody(text), [text]);
  const dirty = text !== initialText;
  const busy = saveState.isLoading || removeState.isLoading;
  const overridden = view.effective?.source === "override";

  const onSave = async () => {
    if (!parsed.ok) return;
    setProblems(null);
    setMessage(null);
    try {
      const row = await save({ accountId, kind, scope, body: parsed.body }).unwrap();
      trackSave({ account_id: accountId, kind, scope: scope ?? "*", version: row.version });
      push({ title: "Override saved", detail: `Version ${row.version} is active for this account.`, tone: "success" });
    } catch (caught) {
      const error = configError(caught);
      if (error.code === "invalid_config" && error.problems && error.problems.length > 0) setProblems(error.problems);
      else setMessage(describeConfigError(error));
    }
  };

  const onRemove = async () => {
    setProblems(null);
    setMessage(null);
    try {
      await remove({ accountId, kind, scope }).unwrap();
      trackRemove({ account_id: accountId, kind, scope: scope ?? "*" });
      push({
        title: "Override removed",
        detail: "The operator default applies to this account again.",
        tone: "success",
      });
    } catch (caught) {
      const error = configError(caught);
      setMessage(describeConfigError(error));
      if (error.code === "not_found") refetch();
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-[12px]">
        <span className="text-xms-label">Body (JSON)</span>
        <textarea
          aria-label="Body"
          spellCheck={false}
          className={cn(INPUT, "xms-mono h-[420px] py-2 text-[12px] leading-[1.5]")}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>
      {!parsed.ok ? <InlineError message={parsed.problem} /> : null}
      {problems ? (
        <div role="alert" className="text-[12px] text-[color:var(--state-overdue-text)]" data-config-problems>
          <p>The server refused the body:</p>
          <ul className="list-disc pl-5">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <InlineError message={message} />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={PRIMARY_BUTTON} onClick={onSave} disabled={!parsed.ok || busy}>
          {overridden ? "Save as new override version" : "Save as override"}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          onClick={() => setText(initialText)}
          disabled={!dirty || busy}
        >
          Reset
        </button>
        {overridden ? (
          <ConfirmButton
            label="Remove override"
            confirmLabel="Confirm remove override"
            onConfirm={onRemove}
            disabled={busy}
            danger
            className="ml-auto"
          />
        ) : null}
      </div>
      <p className="text-xms-label text-[12px]">
        {overridden
          ? "Saving activates a new override version and retires the current one. Removing the override makes the operator default apply again."
          : "Saving creates the first override version for this account; every other account keeps the default."}
      </p>
    </div>
  );
}

function VersionHistory({ view }: { view: AccountConfigView }) {
  return (
    <Panel title="Versions" caption="Override history, newest first, and the operator default underneath">
      {view.overrides.length === 0 ? (
        <p className="text-xms-label text-[13px]">No override yet. The operator default applies.</p>
      ) : null}
      <ul className="flex flex-col gap-2" aria-label="Override versions">
        {view.overrides.map((row) => (
          <li key={row.id} className="flex items-center gap-2 text-[13px]" data-override-version={row.version}>
            <span className="xms-mono">override v{row.version}</span>
            <VersionStatusPill status={row.status} />
            <span className="xms-mono text-xms-label ml-auto text-[11px]">
              {row.activated_by ? `${row.activated_by.slice(0, 8)} ` : ""}
              {formatDate(row.activated_at ?? row.created_at)}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-xms-line mt-3 border-t pt-3">
        {view.default ? (
          <div className="flex items-center gap-2 text-[13px]">
            <span className="xms-mono">default v{view.default.version}</span>
            <VersionStatusPill status={view.default.status} />
            <span className="xms-mono text-xms-label ml-auto text-[11px]">{formatDate(view.default.activated_at)}</span>
          </div>
        ) : (
          <p className="text-xms-label text-[13px]">No operator default is active. Run the seed.</p>
        )}
        {view.effective?.source === "override" && view.default ? (
          <details className="mt-2">
            <summary className="text-xms-accent cursor-pointer text-[12px]">Show the operator default body</summary>
            <pre className="xms-mono text-xms-body bg-xms-tint mt-2 max-h-[320px] overflow-auto rounded-[4px] p-3 text-[11px] whitespace-pre-wrap">
              {formatBody(view.default.body)}
            </pre>
          </details>
        ) : null}
      </div>
    </Panel>
  );
}

export interface OverrideEditorProps {
  accountId: string;
  kind: ConfigKind;
  scope?: string;
  onScopeChange?: (scope: string) => void;
}

/**
 * The editor for one catalog on one account (Accounts & Administration
 * functional 5.8, technical 3.4): the effective source and version, the
 * scope selector where the kind takes one, the JSON body editor with
 * Save and Remove override, and the version history under it.
 */
export function OverrideEditor({ accountId, kind, scope, onScopeChange }: OverrideEditorProps) {
  const entry = catalogKind(kind);
  const { data, isLoading, isError, error, refetch } = useGetAccountConfigQuery({ accountId, kind, scope });
  return (
    <div className="flex flex-col gap-4">
      <Panel
        title={entry?.label ?? kind}
        caption={entry?.detail}
        actions={
          <>
            {entry?.scopes ? (
              <label className="flex items-center gap-2 text-[12px]">
                <span className="text-xms-label">Ticket type</span>
                <select
                  aria-label="Scope"
                  className={cn(INPUT, "h-[28px] w-auto text-[12px]")}
                  value={scope ?? entry.scopes[0].value}
                  onChange={(event) => onScopeChange?.(event.target.value)}
                >
                  {entry.scopes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {data ? <EffectivePill view={data} /> : null}
          </>
        }
      >
        {isLoading ? <Skeleton lines={8} /> : null}
        {isError ? <InlineError message={describeConfigError(configError(error))} /> : null}
        {data && !data.effective ? (
          <p role="status" className="text-xms-label mb-3 text-[13px]" data-nothing-active>
            Nothing active for this kind. No operator default and no override resolve for this account; saving here
            creates the first override.
          </p>
        ) : null}
        {data ? (
          <BodyEditor
            key={`${kind}:${scope ?? "*"}:${data.effective?.versionId ?? "none"}`}
            accountId={accountId}
            kind={kind}
            scope={scope}
            view={data}
            refetch={refetch}
          />
        ) : null}
      </Panel>
      {data ? <VersionHistory view={data} /> : null}
    </div>
  );
}
