"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { groupSkillsByKind, levelCellClass } from "@/lib/capacity/vocab";
import { levelLabel, roleLabel } from "@/lib/roster/vocab";
import { cn } from "@/lib/utils";
import type { MatrixPerson, SkillsMatrixPeople } from "@/redux/capacityApi";

export interface SkillsHeatMapProps {
  matrix: SkillsMatrixPeople;
  /** Narrows the rows to one role code; the API returns everyone. */
  role?: string;
}

/** The rows the heat map shows: the role's people (or everyone), by name. */
export function heatMapRows(people: MatrixPerson[], role?: string): MatrixPerson[] {
  return people
    .filter((person) => !role || person.role === role)
    .sort((a, b) => a.display_name.localeCompare(b.display_name));
}

const HEAD = "text-xms-ink px-2 py-2 text-[14px] font-semibold whitespace-nowrap";

/**
 * The people lens of the skills matrix (functional 5.8): people as rows,
 * the active skills as columns grouped by kind, each cell the level 1 to
 * 4 on the accent ramp with the number, blank where the person has no
 * level on the skill. The levels are the roster's; nothing is edited here.
 */
export function SkillsHeatMap({ matrix, role }: SkillsHeatMapProps) {
  const groups = useMemo(() => groupSkillsByKind(matrix.skills), [matrix.skills]);
  const rows = useMemo(() => heatMapRows(matrix.people, role), [matrix.people, role]);
  const columns = groups.flatMap((group) => group.skills);

  // A grid with zero columns is worse than no grid: with an empty catalog the
  // heat map drew a lone "Person" column and one blank row per person, then
  // apologized underneath. The empty state stands on its own (finding 15).
  if (columns.length === 0) {
    return (
      <Panel title="Skills by person" caption="Skills" subtitle="Nothing to plot until the catalog has a skill.">
        <EmptyBanner
          title="No skills in the catalog yet"
          detail="Add them from a person record. The matrix then plots every person against every skill."
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Skills by person"
      caption="Skills"
      subtitle={`${rows.length} ${rows.length === 1 ? "person" : "people"} against ${columns.length} skill${columns.length === 1 ? "" : "s"}, at levels 1 Aware to 4 Expert from the roster.`}
      flush
    >
      <table className="w-full border-collapse text-[14px]" aria-label="Skills heat map">
        <thead className="bg-xms-card sticky top-0 z-10">
          <tr className="border-xms-line border-b">
            <th className={HEAD} rowSpan={2} scope="col">
              Person
            </th>
            {groups.map((group) => (
              <th
                key={group.kind}
                className={cn(HEAD, "border-xms-line text-xms-label border-l text-center font-medium")}
                colSpan={group.skills.length}
                scope="colgroup"
                data-kind={group.kind}
              >
                {group.label}
              </th>
            ))}
          </tr>
          <tr className="border-xms-line border-b">
            {groups.map((group) =>
              group.skills.map((skill, index) => (
                <th
                  key={skill.id}
                  className={cn(HEAD, "text-center", index === 0 && "border-xms-line border-l")}
                  scope="col"
                  title={skill.code}
                  data-skill={skill.code}
                >
                  {skill.name}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((person) => (
            <tr key={person.id} className="border-xms-line hover:bg-xms-row-hover border-b" data-person={person.id}>
              <td className="text-xms-ink px-2 py-[9px] align-middle whitespace-nowrap">
                <span className="xms-stack">
                  <Link href={`/roster/${person.id}`} className="text-xms-accent font-medium">
                    {person.display_name}
                  </Link>
                  <span className="text-xms-label text-[14px]">{roleLabel(person.role)}</span>
                </span>
              </td>
              {groups.map((group) =>
                group.skills.map((skill, index) => {
                  const level = person.levels[skill.code];
                  return (
                    <td
                      key={skill.id}
                      className={cn(
                        "xms-mono w-[56px] min-w-[56px] text-center align-middle text-[14px] font-semibold",
                        index === 0 && "border-xms-line border-l",
                        levelCellClass(level),
                      )}
                      data-skill={skill.code}
                      data-level={level}
                      title={level ? `${person.display_name}, ${skill.name}: ${level} ${levelLabel(level)}` : undefined}
                    >
                      {level ?? ""}
                    </td>
                  );
                }),
              )}
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={1 + columns.length} className="text-xms-label px-4 py-8 text-center">
                {role ? "No one on the roster has this role." : "No one on the roster yet."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Panel>
  );
}
