"use client";

import Link from "next/link";
import { AccountDot } from "@/components/xms/account-dot";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { Panel } from "@/components/xms/panel";
import { dropOffLine, firstUsedLabel, roleLabel, stepLabel, stepsByKey, stepWidth } from "@/lib/reporting/usage";
import type { AccountFunnel, AdoptionRow, UsageFunnel } from "@/redux/reportingApi";

/**
 * The core loop of Audit & Analytics 7.1 as a step strip: ticket opened,
 * first reply, time logged, solution linked, resolved, and the closure the
 * ticket row records beside them. Each step carries the count the server
 * measured and the fall from the step before it.
 *
 * A negative fall is worded rather than hidden. A step is counted on its own
 * and not as a subset of the one before, so a ticket resolved under a time
 * exemption reaches Resolved without ever reaching Time logged and the later
 * step can hold more; drawing that as a zero, or leaving it out, would
 * misreport the loop.
 *
 * Under the strip, the same window one account at a time, each row opening
 * that account's dashboard.
 */
export function FunnelPanel({ funnel }: { funnel: UsageFunnel }) {
  const steps = funnel.steps ?? [];
  const order = steps.map((step) => step.step);
  const columns: DenseColumn<AccountFunnel>[] = [
    {
      key: "name",
      title: "Account",
      sortValue: (row) => row.name,
      render: (row) => (
        <Link
          href={`/accounts/${row.account_id}`}
          className="text-xms-accent font-medium"
          data-account={row.account_id}
        >
          <AccountDot name={row.name} />
        </Link>
      ),
    },
    { key: "key", title: "Key", mono: true, sortValue: (row) => row.key },
    ...order.map((step) => ({
      key: step,
      title: stepLabel(step),
      align: "right" as const,
      mono: true,
      sortValue: (row: AccountFunnel) => stepsByKey(row.steps)[step] ?? 0,
      render: (row: AccountFunnel) => String(stepsByKey(row.steps)[step] ?? 0),
    })),
  ];

  return (
    <>
      <Panel
        title="Core loop"
        caption="Opened to closed"
        subtitle="Every step counted from the record that proves it. A step is not a subset of the one before, so a later step can hold more tickets than an earlier one."
      >
        <ol className="grid gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="funnel-strip">
          {steps.map((step, index) => {
            const drop = dropOffLine(step, index);
            return (
              <li key={step.step} className="flex flex-col gap-1" data-step={step.step}>
                <span className="xms-caption">{stepLabel(step.step)}</span>
                <span className="xms-mono text-xms-ink text-[20px] font-semibold">{step.n}</span>
                <span className="bg-xms-tint h-[6px] w-full rounded-[3px]">
                  <span
                    className="bg-xms-accent block h-[6px] rounded-[3px]"
                    style={{ width: `${stepWidth(step, steps)}%` }}
                    data-width={stepWidth(step, steps)}
                  />
                </span>
                {drop ? (
                  <span className="text-xms-label text-[12px]" data-drop-off={step.drop_off}>
                    {drop}
                  </span>
                ) : (
                  <span className="text-xms-label text-[12px]">The start of the loop</span>
                )}
              </li>
            );
          })}
        </ol>
      </Panel>

      {funnel.per_account && funnel.per_account.length > 0 ? (
        <DenseTable<AccountFunnel>
          title="Core loop by account"
          columns={columns}
          rows={funnel.per_account}
          rowKey={(row) => row.account_id}
          defaultSort={{ key: "opened", direction: "desc" }}
          emptyState="No granted accounts opened a ticket in the period."
        />
      ) : null}
    </>
  );
}

const ADOPTION_COLUMNS: DenseColumn<AdoptionRow>[] = [
  { key: "role", title: "Role", sortValue: (row) => roleLabel(row), render: (row) => roleLabel(row) },
  { key: "action", title: "Action", mono: true, sortValue: (row) => row.action },
  { key: "users", title: "People", align: "right", mono: true, sortValue: (row) => row.users },
  { key: "n", title: "Times", align: "right", mono: true, sortValue: (row) => row.n },
  {
    key: "first_used_at",
    title: "First used",
    mono: true,
    sortValue: (row) => row.first_used_at,
    render: (row) => firstUsedLabel(row.first_used_at),
  },
];

/**
 * Feature adoption by role: which actions each role uses, how many people
 * used them in the window and when that role first used them at all. The
 * first-use date deliberately reaches past the window, which is what a
 * first-use date means, so the caption says the two figures are read
 * differently.
 *
 * There is no per-account slice: a role assignment is not a fact of the
 * event, and the per-account view of the same window is the funnel and the
 * strip above.
 */
export function AdoptionPanel({ rows }: { rows: AdoptionRow[] }) {
  return (
    <DenseTable<AdoptionRow>
      title="Adoption by role"
      columns={ADOPTION_COLUMNS}
      rows={rows}
      rowKey={(row) => `${row.catalog}:${row.role}:${row.action}`}
      defaultSort={{ key: "n", direction: "desc" }}
      emptyState="No action was recorded in the period."
    />
  );
}
