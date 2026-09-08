"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SignalPill } from "@/components/xms/signal-pill";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { formatPercent, levelLabel, roleLabel } from "@/lib/roster/vocab";
import type { Person } from "@/redux/rosterApi";

export interface PeopleListProps {
  rows: Person[];
  /** Group names by id when the reader may list groups; otherwise the id is shortened. */
  groupNames?: Record<string, string>;
  loading?: boolean;
  search?: ReactNode;
  emptyState?: ReactNode;
}

const CHIP =
  "border-xms-line bg-xms-tint text-xms-body inline-flex h-[22px] items-center gap-1 rounded-[999px] border px-2 text-[11px] whitespace-nowrap";

export function groupLabel(id: string, names?: Record<string, string>): string {
  return names?.[id] ?? id.slice(0, 8);
}

/** A skill chip: the name with the level in mono ("OneStream · 3"). */
export function SkillChip({ name, level, title }: { name: string; level: number; title?: string }) {
  return (
    <span className={CHIP} title={title ?? `${name}: ${levelLabel(level)}`} data-level={level}>
      <span>{name}</span>
      <span className="xms-mono text-xms-accent font-semibold">{level}</span>
    </span>
  );
}

export function GroupChip({ label }: { label: string }) {
  return <span className={CHIP}>{label}</span>;
}

/**
 * The roster list (Capacity & Allocation functional 5.2): one row per
 * person in a Count card. No rates in this cut, and none rendered; every
 * value is the API's.
 */
export function PeopleList({ rows, groupNames, loading, search, emptyState }: PeopleListProps) {
  const columns: DenseColumn<Person>[] = [
    {
      key: "name",
      title: "Name",
      sortValue: (row) => row.display_name,
      render: (row) => (
        <span className="flex flex-col">
          <Link href={`/roster/${row.id}`} className="text-xms-accent font-medium" data-person={row.id}>
            {row.display_name}
          </Link>
          <span className="xms-mono text-xms-label text-[11px]">{row.email}</span>
        </span>
      ),
    },
    { key: "role", title: "Role", sortValue: (row) => roleLabel(row.role), render: (row) => roleLabel(row.role) },
    {
      key: "fte",
      title: "FTE",
      align: "right",
      mono: true,
      sortValue: (row) => Number(row.fte_percent),
      render: (row) => formatPercent(row.fte_percent),
    },
    { key: "time_zone", title: "Time zone", sortValue: (row) => row.time_zone, mono: true },
    {
      key: "groups",
      title: "Groups",
      render: (row) =>
        row.assignment_group_ids.length === 0 ? (
          <span className="text-xms-muted">none</span>
        ) : (
          <span className="flex flex-wrap gap-1" aria-label={`Groups of ${row.display_name}`}>
            {row.assignment_group_ids.map((id) => (
              <GroupChip key={id} label={groupLabel(id, groupNames)} />
            ))}
          </span>
        ),
    },
    {
      key: "skills",
      title: "Skills",
      render: (row) =>
        row.skills.length === 0 ? (
          <span className="text-xms-muted">none</span>
        ) : (
          <span className="flex flex-wrap gap-1" aria-label={`Skills of ${row.display_name}`}>
            {row.skills.map((skill) => (
              <SkillChip key={skill.skill_id} name={skill.name} level={skill.level} />
            ))}
          </span>
        ),
    },
    {
      key: "active",
      title: "Status",
      sortValue: (row) => (row.is_active ? 1 : 0),
      render: (row) =>
        row.is_active ? <SignalPill tone="complete" label="Active" /> : <SignalPill tone="blocked" label="Inactive" />,
    },
  ];
  return (
    <DenseTable
      title="People"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.id}
      loading={loading}
      search={search}
      emptyState={emptyState ?? "No one on the roster yet. Import from the directory to start."}
    />
  );
}
