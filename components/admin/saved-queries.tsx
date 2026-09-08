"use client";

import { useState } from "react";
import { ConfirmButton, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { useToast } from "@/components/xms/toast";
import { apiError } from "@/lib/admin/api-error";
import {
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
export function SavedQueriesPanel({
  conditions,
  onRan,
  onLoad,
}: {
  /** What the condition builder holds right now, as the request body would carry it. */
  conditions: AuditCondition[];
  /** The first page of a run, with the query that answered it, for the results table above. */
  onRan: (page: SavedQueryPage) => void;
  /** Put a saved query's conditions back into the builder without running it. */
  onLoad: (query: AuditSavedQuery) => void;
}) {
  const me = useMe();
  const { push } = useToast();
  const mayShare = me.hasPermission("audit:export");
  const { data, isLoading } = useAuditSavedQueriesQuery();
  const [create, creating] = useCreateAuditSavedQueryMutation();
  const [patch] = usePatchAuditSavedQueryMutation();
  const [remove] = useDeleteAuditSavedQueryMutation();
  const [run, running] = useRunAuditSavedQueryMutation();
  const [draft, setDraft] = useState<SavedQueryDraft | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);

  const queries = data ?? [];

  const refuse = (title: string, error: unknown) => {
    const { code, details, permission } = apiError(error);
    push({ title, detail: describeSavedQueryError(code, details, permission), tone: "error" });
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
      setDraft(null);
      setEditing(null);
    } catch (error) {
      refuse(editing ? "The saved query was not updated" : "The saved query was not saved", error);
    }
  };

  const runOne = async (query: AuditSavedQuery) => {
    try {
      onRan(await run({ id: query.id, limit: PAGE }).unwrap());
    } catch (error) {
      refuse(`${query.name} did not run`, error);
    }
  };

  const destroy = async (query: AuditSavedQuery) => {
    try {
      await remove(query.id).unwrap();
      push({ title: `${query.name} deleted`, tone: "success" });
      if (editing === query.id) {
        setEditing(null);
        setDraft(null);
      }
    } catch (error) {
      refuse(`${query.name} was not deleted`, error);
    }
  };

  return (
    <Panel
      title="Saved queries"
      caption="Named condition sets"
      subtitle="A saved query holds conditions and nothing else. What it shows is decided when it runs, by the accounts granted to whoever runs it."
      actions={
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setProblems([]);
            setDraft(emptySavedQueryDraft());
          }}
          className={SECONDARY_BUTTON}
        >
          Save these conditions
        </button>
      }
    >
      <div className="flex flex-col gap-3" data-testid="saved-queries">
        {draft ? (
          <form
            aria-label={editing ? "Edit saved query" : "Save these conditions"}
            className="border-xms-line flex flex-wrap items-end gap-3 rounded-[6px] border p-3"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <span className="flex flex-col gap-1">
              <label htmlFor="saved-query-name" className="text-xms-label text-[12px]">
                Name
              </label>
              <input
                id="saved-query-name"
                value={draft.name}
                onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                className={cn(INPUT, "w-[240px]")}
              />
            </span>
            <span className="flex flex-col gap-1">
              <label htmlFor="saved-query-description" className="text-xms-label text-[12px]">
                Description
              </label>
              <input
                id="saved-query-description"
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                className={cn(INPUT, "w-[320px]")}
              />
            </span>
            {mayShare ? (
              <label className="text-xms-body flex items-center gap-2 pb-2 text-[13px]">
                <input
                  type="checkbox"
                  checked={draft.shared}
                  onChange={(event) => setDraft({ ...draft, shared: event.target.checked })}
                />
                Share with everyone who can read the audit
              </label>
            ) : (
              <p className="text-xms-label pb-2 text-[12px]">{SHARING_NEEDS_EXPORT}</p>
            )}
            <button type="submit" disabled={creating.isLoading} className={PRIMARY_BUTTON}>
              {editing ? "Update" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(null);
                setEditing(null);
              }}
              className={SECONDARY_BUTTON}
            >
              Cancel
            </button>
            <p className="text-xms-label basis-full text-[12px]">
              {editing
                ? "Updating rewrites the conditions with the ones in the builder now."
                : `${conditions.length} condition${conditions.length === 1 ? "" : "s"} from the builder above.`}
            </p>
            {problems.length > 0 ? (
              <ul className="basis-full text-[12px] text-[color:var(--state-overdue-text)]">
                {problems.map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
              </ul>
            ) : null}
          </form>
        ) : null}

        {isLoading ? <p className="text-xms-label text-[13px]">Reading the saved queries.</p> : null}
        {!isLoading && queries.length === 0 ? (
          <p className="text-xms-label text-[13px]">
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
                <span className="text-xms-ink block truncate text-[13px] font-medium">{query.name}</span>
                <span className="text-xms-label block text-[12px]">
                  {savedQueryLine(query, me.principal?.userId)}
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
                  className="text-xms-accent text-[12px] hover:underline"
                >
                  Load into builder
                </button>
                {isOwner(query, me.principal?.userId) ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(query.id);
                        setProblems([]);
                        setDraft(draftFromSavedQuery(query));
                      }}
                      className="text-xms-accent text-[12px] hover:underline"
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
