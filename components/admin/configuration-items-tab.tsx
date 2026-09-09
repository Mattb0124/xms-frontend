"use client";

import { useMemo, useState } from "react";
import { PRIMARY_BUTTON } from "@/components/admin/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useMe } from "@/redux/me";
import {
  CI_TYPES,
  CI_TYPE_LABEL,
  useCreateConfigurationItemMutation,
  useListConfigurationItemsQuery,
  useUpdateConfigurationItemMutation,
  type ConfigurationItem,
  type CiType,
} from "@/redux/configurationItemsApi";

/**
 * The configuration items an account runs (TM-19): what a case is raised
 * against. The register is read by anyone who may see a case, because a case
 * names one, and written by whoever administers the account.
 *
 * A retired item stays in the register rather than being deleted: cases
 * already名 it, and the history has to keep making sense.
 */
export function ConfigurationItemsTab({ accountId }: { accountId: string }) {
  const me = useMe();
  const { push } = useToast();
  const canEdit = me.hasPermission("admin:config");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const { data, isLoading } = useListConfigurationItemsQuery({
    accountId,
    q: q.trim() || undefined,
    ci_type: type || undefined,
  });
  const [create] = useCreateConfigurationItemMutation();
  const [update] = useUpdateConfigurationItemMutation();
  const [drafting, setDrafting] = useState(false);
  const [draft, setDraft] = useState<{ name: string; ci_type: CiType; external_ref: string }>({
    name: "",
    ci_type: "application",
    external_ref: "",
  });

  const columns = useMemo<DenseColumn<ConfigurationItem>[]>(
    () => [
      {
        key: "name",
        title: "Name",
        wrap: true,
        sortValue: (row) => row.name,
        render: (row) => <span className="text-xms-ink">{row.name}</span>,
      },
      {
        key: "ci_type",
        title: "Kind",
        width: "150px",
        sortValue: (row) => CI_TYPE_LABEL[row.ci_type],
        render: (row) => <span className="text-xms-body">{CI_TYPE_LABEL[row.ci_type]}</span>,
      },
      {
        key: "external_ref",
        title: "Reference",
        width: "180px",
        sortValue: (row) => row.external_ref ?? "",
        render: (row) =>
          row.external_ref ? (
            <span className="xms-mono text-xms-body text-[12px]">{row.external_ref}</span>
          ) : (
            <span className="text-xms-muted">None</span>
          ),
      },
      {
        key: "status",
        title: "Status",
        width: "150px",
        sortValue: (row) => row.status,
        render: (row) =>
          canEdit ? (
            <button
              type="button"
              className="xms-link"
              onClick={() =>
                void update({
                  id: row.id,
                  body: { version: row.version, status: row.status === "active" ? "retired" : "active" },
                })
                  .unwrap()
                  .catch((error) => push({ title: describeError(apiError(error)), tone: "error" }))
              }
            >
              {row.status === "active" ? "Active" : "Retired"}
            </button>
          ) : (
            <span className="text-xms-body">{row.status === "active" ? "Active" : "Retired"}</span>
          ),
      },
    ],
    [canEdit, push, update],
  );

  if (isLoading) return <Skeleton lines={6} />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          aria-label="Search configuration items"
          placeholder="Name or reference"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          className="border-xms-control-line bg-xms-card h-[var(--xms-control-h)] w-[260px] rounded-[var(--xms-radius-control)] border px-3 text-[13px]"
        />
        <select
          aria-label="Kind"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className="border-xms-control-line bg-xms-card h-[var(--xms-control-h)] rounded-[var(--xms-radius-control)] border px-3 text-[13px]"
        >
          <option value="">Every kind</option>
          {CI_TYPES.map((value) => (
            <option key={value} value={value}>
              {CI_TYPE_LABEL[value]}
            </option>
          ))}
        </select>
        {canEdit ? (
          <button type="button" className={PRIMARY_BUTTON} onClick={() => setDrafting((open) => !open)}>
            {drafting ? "Cancel" : "New item"}
          </button>
        ) : null}
      </div>

      {drafting ? (
        <form
          className="xms-card flex flex-wrap items-end gap-3 p-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!draft.name.trim()) return;
            try {
              await create({
                accountId,
                body: {
                  name: draft.name.trim(),
                  ci_type: draft.ci_type,
                  external_ref: draft.external_ref.trim() || undefined,
                },
              }).unwrap();
              push({ title: `${draft.name.trim()} added`, tone: "success" });
              setDraft({ name: "", ci_type: "application", external_ref: "" });
              setDrafting(false);
            } catch (error) {
              push({ title: describeError(apiError(error)), tone: "error" });
            }
          }}
        >
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Name</span>
            <input
              required
              value={draft.name}
              onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
              className="border-xms-control-line bg-xms-card h-[var(--xms-control-h)] w-[280px] rounded-[var(--xms-radius-control)] border px-3 text-[13px]"
            />
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Kind</span>
            <select
              value={draft.ci_type}
              onChange={(event) => setDraft((current) => ({ ...current, ci_type: event.target.value as CiType }))}
              className="border-xms-control-line bg-xms-card h-[var(--xms-control-h)] rounded-[var(--xms-radius-control)] border px-3 text-[13px]"
            >
              {CI_TYPES.map((value) => (
                <option key={value} value={value}>
                  {CI_TYPE_LABEL[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px]">
            <span className="text-xms-label">Reference</span>
            <input
              value={draft.external_ref}
              onChange={(event) => setDraft((current) => ({ ...current, external_ref: event.target.value }))}
              placeholder="The client's own id, where they have one"
              className="border-xms-control-line bg-xms-card h-[var(--xms-control-h)] w-[260px] rounded-[var(--xms-radius-control)] border px-3 text-[13px]"
            />
          </label>
          <button type="submit" className={PRIMARY_BUTTON}>
            Add
          </button>
        </form>
      ) : null}

      <DenseTable<ConfigurationItem>
        title="Configuration items"
        titleHidden
        columns={columns}
        rows={data ?? []}
        rowKey={(row) => row.id}
        emptyState={
          <EmptyBanner
            title="Nothing in the register yet"
            detail={
              canEdit
                ? "Add the environments, applications and integrations this account runs, so a case can name one."
                : "An account administrator adds the environments and applications a case can name."
            }
          />
        }
      />
    </div>
  );
}
