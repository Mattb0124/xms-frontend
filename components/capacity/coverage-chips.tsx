"use client";

import Link from "next/link";
import { useSkillName } from "@/components/capacity/account-coverage";
import { SignalPill } from "@/components/xms/signal-pill";
import { skillsFilterToSearch } from "@/lib/capacity/filters";
import { coverageChipLabel } from "@/lib/capacity/vocab";
import { useSkillsMatrixAccountQuery } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";

/**
 * The account record's coverage chips (functional 5.8): "Single point of
 * failure: OneStream" per technology exactly one person covers at the
 * required level and "Gap: SAP" per technology nobody covers, from the
 * account lens of the skills matrix for this account. Needs capacity:view
 * (the API is not asked otherwise) and renders nothing when nothing is
 * flagged, so a healthy account carries no noise.
 */
export function AccountCoverageChips({ accountId }: { accountId: string }) {
  const me = useMe();
  const allowed = me.hasPermission("capacity:view");
  const lens = useSkillsMatrixAccountQuery({ account: accountId }, { skip: !allowed });
  const skillName = useSkillName();
  const account = lens.data?.accounts.find((row) => row.account_id === accountId);
  if (!account || (account.single_points_of_failure.length === 0 && account.gaps.length === 0)) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" role="list" aria-label="Skills coverage" data-testid="coverage-chips">
      {account.single_points_of_failure.map((code) => (
        <span key={`spof:${code}`} role="listitem" data-chip={`spof:${code}`}>
          <SignalPill
            tone="needs-input"
            label={coverageChipLabel("spof", skillName(code))}
            title="Exactly one person is at the required level"
          />
        </span>
      ))}
      {account.gaps.map((code) => (
        <span key={`gap:${code}`} role="listitem" data-chip={`gap:${code}`}>
          <SignalPill tone="overdue" label={coverageChipLabel("gap", skillName(code))} title="Nobody is at the required level" />
        </span>
      ))}
      <Link
        href={`/capacity/skills${skillsFilterToSearch({ lens: "account", account: accountId })}`}
        className="text-xms-accent text-[12px]"
      >
        Skills matrix
      </Link>
    </div>
  );
}
