"use client";

import Link from "next/link";
import { formatDay } from "@/lib/format/date";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { ArticleStatusPill, GlobalChip, KIND_LABEL } from "@/components/knowledge/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { useListArrangement } from "@/components/xms/use-list-arrangement";
import { FilterSelect } from "@/components/xms/filter-select";
import { ICON, PlusIcon, SearchIcon } from "@/components/xms/icons";
import { KeyLink } from "@/components/xms/key-link";
import { Skeleton } from "@/components/xms/skeleton";
import {
  knowledgeFiltersApplied,
  knowledgeFiltersFromSearch,
  knowledgeFiltersToSearch,
  type KnowledgeFilters,
} from "@/lib/knowledge/list-filters";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useListArticlesQuery, type Article, type ArticleKind, type ArticleStatus } from "@/redux/knowledgeApi";

const STATUSES: ArticleStatus[] = ["draft", "in_review", "published", "retired"];
const KINDS: ArticleKind[] = ["solution", "workaround", "known_error", "procedure", "reference"];

const COLUMNS: DenseColumn<Article>[] = [
  {
    key: "key",
    title: "Key",
    mono: true,
    width: "110px",
    sortValue: (row) => row.display_key,
    render: (row) => <KeyLink ticketKey={row.display_key} href={`/knowledge/${row.display_key}`} />,
  },
  {
    key: "title",
    title: "Title",
    sortValue: (row) => row.title,
    render: (row) => (
      <span className="flex items-center gap-2">
        <span className="text-xms-ink truncate">{row.title}</span>
        <GlobalChip isGlobal={row.is_global} />
      </span>
    ),
  },
  { key: "kind", title: "Kind", sortValue: (row) => row.kind, render: (row) => KIND_LABEL[row.kind] },
  {
    key: "status",
    title: "Status",
    sortValue: (row) => row.status,
    render: (row) => <ArticleStatusPill status={row.status} />,
  },
  { key: "categories", title: "Categories", render: (row) => row.categories.join(", ") },
  { key: "owner", title: "Owner", sortValue: (row) => row.owner_name },
  {
    key: "updated",
    title: "Updated",
    mono: true,
    sortValue: (row) => row.updated_at,
    render: (row) => formatDay(row.updated_at),
  },
];

/** The Solutions list (User Experience 3.7): the same list grammar as the Cases list over the knowledge base. */
function KnowledgeList() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const me = useMe();
  const searchString = search.toString();
  const filters = useMemo(() => knowledgeFiltersFromSearch(new URLSearchParams(searchString)), [searchString]);
  const [query, setQuery] = useState(filters.q);

  const params = useMemo(
    () => ({
      status: filters.status ? [filters.status] : [],
      kind: filters.kind || undefined,
      q: filters.q || undefined,
      limit: 100,
    }),
    [filters],
  );
  const { data, isLoading } = useListArticlesQuery(params);
  const rows = useMemo(() => {
    const items = data ?? [];
    if (filters.global === "yes") return items.filter((row) => row.is_global);
    if (filters.global === "no") return items.filter((row) => !row.is_global);
    return items;
  }, [data, filters.global]);

  const navigate = (next: Partial<KnowledgeFilters>) => {
    const target = knowledgeFiltersToSearch({ ...filters, ...next });
    router.push(target.size > 0 ? `${pathname}?${target.toString()}` : pathname);
  };
  const filtered = knowledgeFiltersApplied(filters);

  // The reader's own arrangement of this list, behind the strip's gear.
  const arrangement = useListArrangement("knowledge", COLUMNS);
  return (
    <div className="flex flex-col gap-4">
      {/* The three dimensions stand on the grey strip as drawn controls, as
          they do on the Cases list and on Groups. The primary one carries the
          number of rows behind it, which is the reference's "Show: Active
          (7)". */}
      <HeaderFilters>
        <FilterSelect
          label="Show"
          primary
          count={rows.length}
          value={filters.status}
          options={STATUSES.map((status) => ({ value: status, label: status.replace(/_/g, " ") }))}
          onChange={(value) => navigate({ status: value })}
        />
        <FilterSelect
          label="Kind"
          value={filters.kind}
          options={KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }))}
          onChange={(value) => navigate({ kind: value })}
        />
        <FilterSelect
          label="Visibility"
          value={filters.global}
          options={[
            { value: "yes", label: "global" },
            { value: "no", label: "account only" },
          ]}
          onChange={(value) => navigate({ global: value })}
        />
      </HeaderFilters>
      <HeaderAction>
        {me.hasPermission("kb:author") ? (
          <Link href="/knowledge/new" className={cn(PRIMARY_BUTTON, "inline-flex items-center gap-1")}>
            <PlusIcon size={ICON.action} />
            New
          </Link>
        ) : null}
      </HeaderAction>
      {isLoading && !data ? (
        <Skeleton lines={8} />
      ) : (
        <>
          <DenseTable<Article>
            title="Solutions"
            columns={arrangement.columns}
            display={arrangement.display}
            rows={rows}
            rowKey={(row) => row.display_key}
            onRowClick={(row) => router.push(`/knowledge/${row.display_key}`)}
            search={
              // The Cases list's own card search, at the same 38px and 400px.
              <form
                className="xms-field xms-field-typed border-xms-line-strong bg-xms-card mx-auto flex h-[38px] w-full max-w-[400px] items-center gap-2 rounded-[4px] border px-[14px]"
                onSubmit={(event) => {
                  event.preventDefault();
                  navigate({ q: query.trim() });
                }}
              >
                <input
                  type="search"
                  aria-label="Search articles by title, category or key"
                  placeholder="Search articles by title, category or key"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="text-xms-ink min-w-0 flex-1 bg-transparent text-[14px] outline-none"
                />
                <button
                  type="submit"
                  aria-label="Run the search"
                  className="text-xms-muted hover:text-xms-ink shrink-0"
                >
                  <SearchIcon size={ICON.action} />
                </button>
              </form>
            }
            // A line where the rows would be, not a card standing inside the card.
            emptyState={
              filtered
                ? "No articles here. Set a dimension back to all to widen the list."
                : "No articles yet. Resolving a ticket creates the first one."
            }
          />
          {arrangement.dialogue}
        </>
      )}
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <AdminGate permission="tickets:view">
      <Suspense fallback={<Skeleton lines={8} />}>
        <KnowledgeList />
      </Suspense>
    </AdminGate>
  );
}
