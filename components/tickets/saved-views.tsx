"use client";

import { useState } from "react";
import { ConfirmButton, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { GroupName, GroupPicker } from "@/components/tickets/group-picker";
import { useToast, type ToastItem } from "@/components/xms/toast";
import { apiError } from "@/lib/admin/api-error";
import {
  definitionFromParams,
  describeSavedViewError,
  isNotDeployed,
  SHARE_MODES,
  shareLabel,
  validateSavedView,
  type SavedViewDraft,
  type ShareMode,
} from "@/lib/tickets/saved-views";
import type { ExportCondition } from "@/lib/tickets/export-conditions";
import type { TicketListParams } from "@/lib/tickets/queue-views";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import {
  useCreateSavedViewMutation,
  useDeleteSavedViewMutation,
  useListSavedViewsQuery,
  usePatchSavedViewMutation,
  type GrantedAccount,
  type SavedView,
} from "@/redux/ticketsApi";

/**
 * The saved views the Queue can show, and whether the route answered at all.
 * `/v1/views` stands on `tickets:view`, the Queue's own gate, so a reader who
 * reached the Queue may read and write views; what the fallback is for is an
 * API that does not serve the route yet, which answers 404 or 501. In that
 * case the screen keeps its per-browser stars and says nothing about views.
 */
export function useSavedViews(): { views: SavedView[]; available: boolean } {
  const { data, error } = useListSavedViewsQuery();
  if (error && isNotDeployed(apiError(error).status)) return { views: [], available: false };
  return { views: data ?? [], available: true };
}

/** The label the view list shows for one saved view: its name, with who else has it. */
export function savedViewLabel(view: SavedView): string {
  return view.share === "private" ? view.name : `${view.name} (${shareLabel(view.share).toLowerCase()})`;
}

/** Who else has a view, in words: a group share names the group it is for. */
function ShareLine({ view }: { view: SavedView }) {
  if (view.share !== "group") return <>{shareLabel(view.share).toLowerCase()}</>;
  return (
    <>
      shared with <GroupName id={view.share_ref} />
    </>
  );
}

function refusal(title: string, error: unknown): Omit<ToastItem, "id"> {
  const { code, details } = apiError(error);
  return { title, detail: describeSavedViewError(code, details), tone: "error" };
}

/** The Save as view form: a fresh draft each time it opens, checked here first, then the create. */
function useSaveViewForm({
  params,
  built,
  accounts,
  onSaved,
}: {
  params: TicketListParams;
  built: ExportCondition[];
  accounts: GrantedAccount[];
  onSaved: (view: SavedView) => void;
}) {
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<SavedViewDraft>({ name: "", share: "private", accountId: "", groupId: "" });
  const [problems, setProblems] = useState<string[]>([]);
  const [create, creating] = useCreateSavedViewMutation();

  const chipAccount = params.account_id?.[0];
  const defaultAccount = chipAccount ?? (accounts.length === 1 ? accounts[0].id : "");

  const openForm = () => {
    setDraft({ name: "", share: "private", accountId: defaultAccount, groupId: "" });
    setProblems([]);
    setOpen(true);
  };

  const update = (patch: Partial<SavedViewDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = async () => {
    const found = validateSavedView(draft);
    setProblems(found);
    if (found.length > 0) return;
    const { definition, notes } = definitionFromParams(params, built);
    try {
      const view = await create({
        account_id: draft.accountId,
        name: draft.name.trim(),
        definition,
        share: draft.share,
        // The API takes share_ref on a group share alone, and refuses one
        // without it (share_ref_required).
        share_ref: draft.share === "group" ? draft.groupId : undefined,
      }).unwrap();
      setOpen(false);
      push({ title: `${view.name} saved`, detail: notes.join(" ") || undefined, tone: "success" });
      onSaved(view);
    } catch (error) {
      push(refusal("The view was not saved", error));
    }
  };

  return { open, draft, update, problems, saving: creating.isLoading, openForm, close: () => setOpen(false), save };
}

/** Rename, reshare and delete: what the owner of the view being shown may do to it. */
function useOwnerActions(onDeleted: () => void) {
  const { push } = useToast();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [resharingGroup, setResharingGroup] = useState(false);
  const [patch] = usePatchSavedViewMutation();
  const [remove] = useDeleteSavedViewMutation();

  const rename = async (view: SavedView, next: string) => {
    setRenaming(null);
    if (next.trim() === "" || next.trim() === view.name) return;
    try {
      await patch({ id: view.id, body: { version: view.version, name: next.trim() } }).unwrap();
      push({ title: "View renamed", tone: "success" });
    } catch (error) {
      push(refusal("The view was not renamed", error));
    }
  };

  /**
   * Resharing. A move to `group` has to name the group, so the select opens
   * the picker and the patch waits for it; a move away clears `share_ref`,
   * because a private view pointing at a group is a fact that is no longer
   * true.
   */
  const reshare = async (view: SavedView, next: ShareMode, ref?: string) => {
    if (next === "group" && !ref) {
      setResharingGroup(true);
      return;
    }
    setResharingGroup(false);
    try {
      await patch({
        id: view.id,
        body: { version: view.version, share: next, share_ref: next === "group" ? ref : null },
      }).unwrap();
      push({ title: `Shared: ${shareLabel(next).toLowerCase()}`, tone: "success" });
    } catch (error) {
      push(refusal("The view was not reshared", error));
    }
  };

  const destroy = async (view: SavedView) => {
    try {
      await remove(view.id).unwrap();
      push({ title: `${view.name} deleted`, tone: "success" });
      onDeleted();
    } catch (error) {
      push(refusal("The view was not deleted", error));
    }
  };

  return { renaming, setRenaming, resharingGroup, rename, reshare, destroy };
}

export interface StarFallbackProps {
  starred: boolean;
  onToggleStar: () => void;
}

/**
 * Without the route there is nothing to save to, so the control stays the
 * per-browser star the finder bar reads, and says so.
 */
function StarFallback({ starred, onToggleStar }: StarFallbackProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-body" data-testid="saved-views">
      <button type="button" onClick={onToggleStar} aria-pressed={starred} className="xms-link">
        {starred ? "Starred" : "Star this list"}
      </button>
      <span className="text-xms-label">
        Saved views are not available on this API. This star is kept in this browser.
      </span>
    </div>
  );
}

export interface CurrentViewLineProps {
  view: SavedView;
  owned: boolean;
  resharingGroup: boolean;
  onRename: () => void;
  onReshare: (next: ShareMode, ref?: string) => void;
  onDelete: () => Promise<void>;
}

/** The view being shown, and for its owner the controls that change it. */
function CurrentViewLine({ view, owned, resharingGroup, onRename, onReshare, onDelete }: CurrentViewLineProps) {
  return (
    <span className="flex flex-wrap items-center gap-2">
      <span className="text-xms-label">
        Showing {view.name}, <ShareLine view={view} />
      </span>
      {owned ? (
        <>
          <button type="button" onClick={onRename} className="xms-link">
            Rename
          </button>
          <select
            aria-label="Sharing"
            value={view.share}
            onChange={(event) => onReshare(event.target.value as ShareMode)}
            className="border-xms-line bg-xms-card text-xms-ink h-[26px] rounded-control border px-1 text-body"
          >
            {SHARE_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {shareLabel(mode)}
              </option>
            ))}
          </select>
          {resharingGroup ? (
            <GroupPicker
              aria-label="Share with group"
              value={view.share_ref}
              allowNone={false}
              className="h-[26px] w-[180px] text-body"
              onChange={(next) => {
                if (next) onReshare("group", next);
              }}
            />
          ) : null}
          <ConfirmButton
            label="Delete"
            confirmLabel="Confirm delete"
            danger
            onConfirm={onDelete}
            className="h-[26px] px-2 text-body"
          />
        </>
      ) : (
        <span className="text-xms-label">Saved by someone else, so it is read only here.</span>
      )}
    </span>
  );
}

export interface RenameFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

function RenameForm({ value, onChange, onSubmit, onCancel }: RenameFormProps) {
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(value);
      }}
    >
      <label htmlFor="saved-view-rename" className="text-xms-label text-body">
        New name
      </label>
      <input
        id="saved-view-rename"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(INPUT, "max-w-[260px]")}
      />
      <button type="submit" className={PRIMARY_BUTTON}>
        Rename
      </button>
      <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
        Cancel
      </button>
    </form>
  );
}

export interface SaveViewFormProps {
  draft: SavedViewDraft;
  onChange: (patch: Partial<SavedViewDraft>) => void;
  accounts: GrantedAccount[];
  problems: string[];
  saving: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

function SaveViewForm({ draft, onChange, accounts, problems, saving, onSubmit, onCancel }: SaveViewFormProps) {
  return (
    <form
      className="border-xms-line bg-xms-card flex flex-wrap items-end gap-3 rounded-card border p-3"
      aria-label="Save as view"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <span className="flex flex-col gap-1">
        <label htmlFor="saved-view-name" className="text-xms-label text-body">
          Name
        </label>
        <input
          id="saved-view-name"
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          className={cn(INPUT, "w-[240px]")}
        />
      </span>
      <span className="flex flex-col gap-1">
        <label htmlFor="saved-view-account" className="text-xms-label text-body">
          Account
        </label>
        <select
          id="saved-view-account"
          value={draft.accountId}
          onChange={(event) => onChange({ accountId: event.target.value })}
          className={cn(INPUT, "w-[220px]")}
        >
          <option value="">Choose</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </span>
      <span className="flex flex-col gap-1">
        <label htmlFor="saved-view-share" className="text-xms-label text-body">
          Shared with
        </label>
        <select
          id="saved-view-share"
          value={draft.share}
          onChange={(event) => onChange({ share: event.target.value as ShareMode })}
          className={cn(INPUT, "w-[220px]")}
        >
          {SHARE_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {shareLabel(mode)}
            </option>
          ))}
        </select>
      </span>
      {draft.share === "group" ? (
        <span className="flex flex-col gap-1">
          <label htmlFor="saved-view-group" className="text-xms-label text-body">
            Group
          </label>
          <GroupPicker
            id="saved-view-group"
            aria-label="Group"
            value={draft.groupId}
            allowNone={false}
            onChange={(next) => onChange({ groupId: next ?? "" })}
            className="w-[220px]"
          />
        </span>
      ) : null}
      <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
        Save view
      </button>
      <button type="button" onClick={onCancel} className={SECONDARY_BUTTON}>
        Cancel
      </button>
      <p className="text-xms-label basis-full text-body">
        A view is filed under one account and carries the chips as they are now.
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

export interface SavedViewsBarProps {
  /** The list the Queue is showing, view preset and chips already merged. */
  params: TicketListParams;
  /**
   * The filter builder's own conditions, as objects. `params.conditions` is
   * base64url by the time it reaches here, so the set has to arrive beside
   * it: otherwise a saved view would drop every condition the builder added
   * and quietly show more than the list the reader was looking at.
   */
  built?: ExportCondition[];
  accounts: GrantedAccount[];
  /** The saved view whose conditions are in the URL, where one is. */
  current: SavedView | null;
  onSaved: (view: SavedView) => void;
  onDeleted: () => void;
  /** The per-browser star for this address, kept as the fallback while the route is not deployed. */
  starred: boolean;
  onToggleStar: () => void;
  available: boolean;
}

/**
 * Save as view, and rename and delete for the one being shown.
 *
 * Saving takes the Queue's current view and chips, turns them into the
 * server's ConditionSet through the same translation the export uses, and
 * files the view under one account, because `POST /v1/views` requires one:
 * the account chip decides it where there is one, and the picker asks
 * otherwise rather than guessing on the reader's behalf.
 */
export function SavedViewsBar({
  params,
  built = [],
  accounts,
  current,
  onSaved,
  onDeleted,
  starred,
  onToggleStar,
  available,
}: SavedViewsBarProps) {
  const me = useMe();
  const form = useSaveViewForm({ params, built, accounts, onSaved });
  const owner = useOwnerActions(onDeleted);
  const owned = current !== null && current.owner_id === me.principal?.userId;

  if (!available) return <StarFallback starred={starred} onToggleStar={onToggleStar} />;

  return (
    <div className="flex flex-col gap-2" data-testid="saved-views">
      <div className="flex flex-wrap items-center gap-3 text-body">
        <button type="button" onClick={form.openForm} className="xms-action-link">
          Save as view
        </button>
        {current ? (
          <CurrentViewLine
            view={current}
            owned={owned}
            resharingGroup={owner.resharingGroup}
            onRename={() => owner.setRenaming(current.name)}
            onReshare={(next, ref) => void owner.reshare(current, next, ref)}
            onDelete={() => owner.destroy(current)}
          />
        ) : null}
      </div>

      {owner.renaming !== null && current ? (
        <RenameForm
          value={owner.renaming}
          onChange={owner.setRenaming}
          onSubmit={(next) => void owner.rename(current, next)}
          onCancel={() => owner.setRenaming(null)}
        />
      ) : null}

      {form.open ? (
        <SaveViewForm
          draft={form.draft}
          onChange={form.update}
          accounts={accounts}
          problems={form.problems}
          saving={form.saving}
          onSubmit={() => void form.save()}
          onCancel={form.close}
        />
      ) : null}
    </div>
  );
}
