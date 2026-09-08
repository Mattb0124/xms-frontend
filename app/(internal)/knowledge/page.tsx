"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { AdminGate, PRIMARY_BUTTON } from "@/components/admin/primitives";
import { ArticleStatusPill, GlobalChip, KIND_LABEL } from "@/components/knowledge/primitives";
import { HeaderAction, HeaderFilters } from "@/components/shell/content-header-bar";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { FilterBar } from "@/components/xms/filter-bar";
import { KeyLink } from "@/components/xms/key-link";
import { Skeleton } from "@/components/xms/skeleton";
import { cn } from "@/lib/utils";
import { useMe } from "@/redux/me";
import { useListArticlesQuery, type Article, type ArticleKind, type ArticleStatus } from "@/redux/knowledgeApi";

const STATUSES: ArticleStatus[] = ["draft", "in_review", "published", "retired"];
const KINDS: ArticleKind[] = ["solution", "workaround", "known_error", "procedure", "reference"];
const CHIP_SELECT = "border-xms-line bg-xms-card text-xms-ink h-[28px] rounded-[4px] border px-2 text-[12px]";

type ChipKey = "status" | "kind" | "global";

interface Chip {
  key: ChipKey;
  value: string;
}

function chipsFromSearch(search: URLSearchParams): { chips: Chip[]; q: string } {
  const chips: Chip[] = [];
  for (const key of ["status", "kind", "global"] as ChipKey[]) {
    const raw = search.get(key);
    if (!raw) continue;
    for (const value of raw.split(",").filter(Boolean)) chips.push({ key, value });
  }
  return { chips, q: search.get("q") ?? "" };
}

function chipsToSearch(chips: Chip[], q: string): URLSearchParams {
  const search = new URLSearchParams();
  for (const key of ["status", "kind", "global"] as ChipKey[]) {
    const values = chips.filter((chip) => chip.key === key).map((chip) => chip.value);
    if (values.length > 0) search.set(key, values.join(","));
  }
  if (q) search.set("q", q);
  return search;
}

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
    render: (row) => row.updated_at.slice(0, 10),
  },
];

/** The Solutions list (User Experience 3.7): the same list grammar as the Queue over the knowledge base. */
function KnowledgeList() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const me = useMe();
  const searchString = search.toString();
  const parsed = useMemo(() => chipsFromSearch(new URLSearchParams(searchString)), [searchString]);
  const [query, setQuery] = useState(parsed.q);
  const [adding, setAdding] = useState<ChipKey | null>(null);

  const params = useMemo(
    () => ({
      status: parsed.chips.filter((chip) => chip.key === "status").map((chip) => chip.value),
      kind: parsed.chips.find((chip) => chip.key === "kind")?.value,
      q: parsed.q || undefined,
      limit: 100,
    }),
    [parsed],
  );
  const { data, isLoading } = useListArticlesQuery(params);
  const globalChip = parsed.chips.find((chip) => chip.key === "global")?.value;
  const rows = useMemo(() => {
    const items = data ?? [];
    if (globalChip === "yes") return items.filter((row) => row.is_global);
    if (globalChip === "no") return items.filter((row) => !row.is_global);
    return items;
  }, [data, globalChip]);

  const navigate = (next: { chips?: Chip[]; q?: string }) => {
    const target = chipsToSearch(next.chips ?? parsed.chips, next.q ?? parsed.q);
    router.push(target.size > 0 ? `${pathname}?${target.toString()}` : pathname);
  };

  const chipOptions = (key: ChipKey): { value: string; label: string }[] => {
    if (key === "status") return STATUSES.map((status) => ({ value: status, label: status.replace(/_/g, " ") }));
    if (key === "kind") return KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }));
    return [
      { value: "yes", label: "Global" },
      { value: "no", label: "Account only" },
    ];
  };
  const filtered = parsed.chips.length > 0 || parsed.q !== "";

  return (
    <div className="flex flex-col gap-4">
      <HeaderFilters>
        <div className="flex items-center gap-2">
          <FilterBar
            criteria={parsed.chips.map((chip) => ({
              key: `${chip.key}:${chip.value}`,
              label: chip.key === "global" ? "Visibility" : chip.key === "kind" ? "Kind" : "Status",
              value: chip.key === "kind" ? KIND_LABEL[chip.value as ArticleKind] : chip.value.replace(/_/g, " "),
            }))}
            onRemove={(id) => navigate({ chips: parsed.chips.filter((chip) => `${chip.key}:${chip.value}` !== id) })}
            onAdd={() => setAdding((current) => (current ? null : "status"))}
            onClearAll={() => navigate({ chips: [], q: "" })}
          />
          {adding ? (
            <span className="flex items-center gap-1" data-testid="add-filter">
              <select
                aria-label="Filter dimension"
                value={adding}
                onChange={(event) => setAdding(event.target.value as ChipKey)}
                className={CHIP_SELECT}
              >
                <option value="status">Status</option>
                <option value="kind">Kind</option>
                <option value="global">Visibility</option>
              </select>
              <select
                aria-label="Filter value"
                defaultValue=""
                onChange={(event) => {
                  if (!event.target.value) return;
                  navigate({ chips: [...parsed.chips, { key: adding, value: event.target.value }] });
                  setAdding(null);
                }}
                className={CHIP_SELECT}
              >
                <option value="">Choose</option>
                {chipOptions(adding).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
          ) : null}
        </div>
      </HeaderFilters>
      <HeaderAction>
        {me.hasPermission("kb:author") ? (
          <Link href="/knowledge/new" className={cn(PRIMARY_BUTTON, "inline-flex items-center")}>
            + New article
          </Link>
        ) : null}
      </HeaderAction>
      {isLoading && !data ? (
        <Skeleton lines={8} />
      ) : (
        <DenseTable<Article>
          title="Solutions"
          columns={COLUMNS}
          rows={rows}
          rowKey={(row) => row.display_key}
          onRowClick={(row) => router.push(`/knowledge/${row.display_key}`)}
          search={
            <form
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
                className="border-xms-line bg-xms-card text-xms-ink h-[32px] w-[320px] rounded-[4px] border px-3 text-[13px] outline-none"
              />
            </form>
          }
          emptyState={
            <EmptyBanner
              title="No articles yet"
              detail={filtered ? "Clear the filters to widen the list." : "Resolving a ticket creates the first one."}
              action={filtered ? { label: "Clear all", onClick: () => navigate({ chips: [], q: "" }) } : undefined}
            />
          }
        />
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
