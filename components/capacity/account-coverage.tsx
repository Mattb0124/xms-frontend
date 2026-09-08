"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { COVERAGE_STATUS } from "@/lib/capacity/vocab";
import type { AccountCoverage, CoverageStatus, SkillsMatrixAccount } from "@/redux/capacityApi";
import { useMe } from "@/redux/me";
import { useListSkillsQuery } from "@/redux/rosterApi";

export function CoveragePill({ status }: { status: CoverageStatus }) {
  const { label, tone } = COVERAGE_STATUS[status];
  return <SignalPill tone={tone} label={label} />;
}

/**
 * The account lens names technologies by code; the skills catalog
 * (capacity:view) gives them their names. A code the catalog does not
 * hold (a contract can require a technology nobody is skilled in yet) is
 * shown as the code.
 */
export function useSkillName(): (code: string) => string {
  const me = useMe();
  const skills = useListSkillsQuery(undefined, { skip: !me.hasPermission("capacity:view") });
  return useMemo(() => {
    const names = new Map((skills.data ?? []).map((skill) => [skill.code, skill.name]));
    return (code: string) => names.get(code) ?? code;
  }, [skills.data]);
}

function AccountCoverageCard({
  account,
  requiredLevel,
  skillName,
}: {
  account: AccountCoverage;
  requiredLevel: number;
  skillName: (code: string) => string;
}) {
  const count = account.technologies.length;
  const flags = [
    account.single_points_of_failure.length > 0
      ? `${account.single_points_of_failure.length} single point${account.single_points_of_failure.length === 1 ? "" : "s"} of failure`
      : null,
    account.gaps.length > 0 ? `${account.gaps.length} gap${account.gaps.length === 1 ? "" : "s"}` : null,
  ].filter((flag): flag is string => flag !== null);
  return (
    <Panel
      title={`${account.key} ${account.name}`}
      caption="Coverage"
      subtitle={`${count} technolog${count === 1 ? "y" : "ies"} required by the active contracts${flags.length > 0 ? `, ${flags.join(", ")}` : ""}.`}
      flush
    >
      {count === 0 ? (
        <p className="text-xms-label px-4 py-3 text-[12px]">
          No technologies on the active contracts. Add technology codes to the rules of a contract.
        </p>
      ) : (
        <ul className="divide-xms-line divide-y" aria-label={`Technologies for ${account.key}`}>
          {account.technologies.map((technology) => (
            <li
              key={technology.code}
              className="flex flex-wrap items-center gap-3 px-4 py-2 text-[13px]"
              data-technology={technology.code}
              data-status={technology.status}
            >
              <span className="text-xms-ink min-w-[160px] font-medium" title={technology.code}>
                {skillName(technology.code)}
              </span>
              <CoveragePill status={technology.status} />
              <span className="text-xms-body text-[12px]" data-qualified>
                {technology.qualified.length === 0
                  ? `Nobody at level ${requiredLevel}`
                  : technology.qualified.map((person, index) => (
                      <span key={person.person_id}>
                        {index > 0 ? ", " : ""}
                        <Link href={`/roster/${person.person_id}`} className="text-xms-accent">
                          {person.display_name}
                        </Link>
                      </span>
                    ))}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * The account lens of the skills matrix (functional 5.8): one card per
 * account listing each technology its active contracts require, the
 * status (Covered, Single point of failure, Gap) and the people at the
 * required level. Every status is the server's.
 */
export function AccountCoverageCards({ view }: { view: SkillsMatrixAccount }) {
  const skillName = useSkillName();
  return (
    <div className="flex flex-col gap-4" data-testid="account-coverage">
      {view.accounts.map((account) => (
        <AccountCoverageCard
          key={account.account_id}
          account={account}
          requiredLevel={view.required_level}
          skillName={skillName}
        />
      ))}
    </div>
  );
}
