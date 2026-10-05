"use client";

import { useState } from "react";
import { ConfirmButton, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { useToast, type ToastItem } from "@/components/xms/toast";
import { apiError } from "@/lib/admin/api-error";
import {
  conditionsLabel,
  describeSavedQueryError,
  draftFromSavedQuery,
  emptySavedQueryDraft,
  isOwner,
  savedQueryBody,
  savedQueryLine,
  SHARING_NEEDS_EXPORT,
  validateSavedQuery,
  type SavedQueryDraft,
} from "@/lib/reporting/saved-queries";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useAuditSavedQueriesQuery,
  useCreateAuditSavedQueryMutation,
  useDeleteAuditSavedQueryMutation,
  usePatchAuditSavedQueryMutation,
  useRunAuditSavedQueryMutation,
  type AuditCondition,
  type AuditSavedQuery,
  type SavedQueryPage,
} from "@/redux/reportingApi";

const PAGE = 100;

function refusal(title: string, error: unknown): Omit<ToastItem, "id"> {
  const { code, details, permission } = apiError(error);
  return { title, detail: describeSavedQueryError(code, details, permission), tone: "error" };
}

/** The save form's draft, the query it rewrites (none for a new one), what the last attempt refused, and the save. */
function useSavedQueryForm(conditions: AuditCondition[]) {
  const { push } = useToast();
  const [create, creating] = useCreateAuditSavedQueryMutation();
  const [patch] = usePatchAuditSavedQueryMutation();
  const [draft, setDraft] = useState<SavedQueryDraft | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const open = (id: string | null, opened: SavedQueryDraft) => {
    setEditing(id);
    setProblems([]);
    setDraft(opened);
  };

  const close = () => {
    setDraft(null);
    setEditing(null);
  };

  const save = async () => {
    if (!draft) return;
    const found = validateSavedQuery(draft, conditions);
    setProblems(found);
    if (found.length > 0) return;
    const body = savedQueryBody(draft, conditions);
    try {
      if (editing) await patch({ id: editing, body }).unwrap();
      else await create(body).unwrap();
      push({ title: editing ? `${body.name} updated` : `${body.name} saved`, tone: "success" });
      close();
    } catch (error) {
      push(refusal(editing ? "The saved query was not updated" : "The saved query was not saved", error));
    }
  };

  return { draft, setDraft, editing, problems, creating: creating.isLoading, open, close, save };
}

export interface SavedQueriesPanelProps {
  /** What the condition builder holds right now, as the request body would carry it. */
  conditions: AuditCondition[];
  /** The first page of a run, with the query that answered it, for the results table above. */
  onRan: (page: SavedQueryPage) => void;
  /** Put a saved query's conditions back into the builder without running it. */
  onLoad: (query: AuditSavedQuery) => void;
}

/**
 * The saved queries of the audit search (Audit & Analytics 7.1). Named
 * condition sets over the same three streams: run one, load one back into the
 * builder, save what is in the builder now, rename and delete your own.
 *
 * Everything here stands on `audit:read`, the permission the search itself
 * takes, so this panel is mounted inside the screen's gate and asks nothing
 * of its own. The one exception is sharing, which needs `audit:export`
 * because a shared query is how audit rows are put in front of other people:
 * the switch is not offered without that key rather than offered and refused.
 */
export function SavedQueriesPanel({ conditions, onRan, onLoad }: SavedQueriesPanelProps) {
  const me = useMe();
  const { push } = useToast();
  const viewer = me.principal?.userId;
  const { data, isLoading } = useAuditSavedQueriesQuery();
  const [remove] = useDeleteAuditSavedQueryMutation();
  const [run, running] = useRunAuditSavedQueryMutation();
  const form = useSavedQueryForm(conditions);

  const queries = data ?? [];

  const runOne = async (query: AuditSavedQuery) => {
    try {
      onRan(await run({ id: query.id, limit: PAGE }).unwrap());
    } catch (error) {
      push(refusal(`${query.name} did not run`, error));
    }
  };

  const destroy = async (query: AuditSavedQuery) => {
    try {
      await remove(query.id).unwrap();
      push({ title: `${query.name} deleted`, tone: "success" });
      if (form.editing === query.id) form.close();
    } catch (error) {
      push(refusal(`${query.name} was not deleted`, error));
    }
  };

  return (
    <Panel
      title="Saved queries"
      caption="Named condition sets"
      subtitle="A saved query holds conditions and nothing else. What it shows is decided when it runs, by the accounts granted to whoever runs it."
      actions={
        <button type="button" onClick={() => form.open(null, emptySavedQueryDraft())} className={SECONDARY_BUTTON}>
          Save these conditions
        </button>
      }
    >
      <div className="flex flex-col gap-3" data-testid="saved-queries">
        {form.draft ? (
          <SaveQueryForm
            draft={form.draft}
            editing={Boolean(form.editing)}
            conditionCount={conditions.length}
            mayShare={me.hasPermission("audit:export")}
            problems={form.problems}
            creating={form.creating}
            onChange={form.setDraft}
            onSave={() => void form.save()}
            onCancel={form.close}
          />
        ) : null}

        {isLoading ? <p className="text-xms-label text-body">Reading the saved queries.</p> : null}
        {!isLoading && queries.length === 0 ? (
          <p className="text-xms-label text-body">
            No saved queries yet. Build a search above and save it to come back to it.
          </p>
        ) : null}

        <ul className="flex flex-col">
          {queries.map((query) => (
            <li
              key={query.id}
              className="border-xms-line flex flex-wrap items-center gap-3 border-b py-2 last:border-b-0"
              data-query={query.id}
            >
              <span className="min-w-0">
                <span className="text-xms-ink block truncate text-body font-medium">{query.name}</span>
                <span className="text-xms-label block text-body">
                  {savedQueryLine(query, viewer)}
                  {query.description ? `. ${query.description}` : ""}
                </span>
              </span>
              <span className="ml-auto flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={running.isLoading}
                  onClick={() => void runOne(query)}
                  className={SECONDARY_BUTTON}
                >
                  Run
                </button>
                <button
                  type="button"
                  onClick={() => onLoad(query)}
                  className="text-xms-accent text-body hover:underline"
                >
                  Load into builder
                </button>
                {isOwner(query, viewer) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => form.open(query.id, draftFromSavedQuery(query))}
                      className="text-xms-accent text-body hover:underline"
                    >
                      Rename
                    </button>
                    <ConfirmButton
                      label="Delete"
                      confirmLabel="Confirm delete"
                      danger
                      onConfirm={() => destroy(query)}
                    />
                  </>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

export interface SaveQueryFormProps {
  draft: SavedQueryDraft;
  /** Whether the draft rewrites a query already saved rather than adding one. */
  editing: boolean;
  /** How many conditions the builder holds, which are what the query is saved with. */
  conditionCount: number;
  mayShare: boolean;
  problems: string[];
  creating: boolean;
  onChange: (draft: SavedQueryDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}

function SaveQueryForm({
  draft,
  editing,
  conditionCount,
  mayShare,
  problems,
  creating,
  onChange,
  onSave,
  onCancel,
}: SaveQueryFormProps) {
  return (
    <form
      aria-label={editing ? "Edit saved query" : "Save these conditions"}
      className="border-xms-line flex flex-wrap items-end gap-3 rounded-card border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <span className="flex flex-col gap-1">
        <label htmlFor="saved-query-name" className="text-xms-label text-body">
          Name
        </label>
        <input
          id="saved-query-name"
          value={draft.name}
          onChange={(event) => onChange({ ...draft, name: event.target.value })}
          className={cn(INPUT, "w-[240px]")}
        />
      </span>
      <span className="flex flex-col gap-1">
        <label htmlFor="saved-query-description" className="text-xms-label text-body">
          Description
        </label>
        <input
          id="saved-query-description"
          value={draft.description}
          onChange={(event) => onChange({ ...draft, description: event.target.value })}
          className={cn(INPUT, "w-[320px]")}
        />
      </span>
      {mayShare ? (
        <label className="text-xms-body flex items-center gap-2 pb-2 text-body">
          <input
            type="checkbox"
            checked={draft.shared}
            onChange={(event) => onChange({ ...draft, shared: event.target.checked })}
          />
          Share with everyone who can read the audit
        </label>
      ) : (
        <p className="text-xms-label pb-2 text-body">{SHARING_NEEDS_EXPORT}</p>
      )}
      <button type="submit" disabled={creating} className={PRIMARY_BUTTON}>
        {editing ? "Update" : "Save"}
      </button>
      <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
        Cancel
      </button>
      <p className="text-xms-label basis-full text-body">
        {editing
          ? "Updating rewrites the conditions with the ones in the builder now."
          : `${conditionsLabel(conditionCount)} from the builder above.`}
      </p>
      {problems.length > 0 ? (
        <ul className="basis-full text-body text-[color:var(--state-overdue-text)]">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
