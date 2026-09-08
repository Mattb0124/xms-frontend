"use client";

import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AdminGate, RecordBar, SwitchRow } from "@/components/admin/primitives";
import { CalendarTab } from "@/components/roster/calendar-tab";
import { CertificationsTab } from "@/components/roster/certifications-tab";
import { DetailsTab } from "@/components/roster/details-tab";
import { PtoTab } from "@/components/roster/pto-tab";
import { SkillsTab } from "@/components/roster/skills-tab";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { roleLabel } from "@/lib/roster/vocab";
import { useTrack } from "@/lib/telemetry/provider";
import { useListGroupsQuery } from "@/redux/adminApi";
import { useMe } from "@/redux/me";
import { useGetPersonQuery, usePatchPersonMutation } from "@/redux/rosterApi";

/**
 * The screen itself, mounted only once the reader holds the permission,
 * so the queries below are never sent by someone the API would refuse
 * (review finding 25).
 */
function PersonRecordPageBody() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const me = useMe();
  const canAdmin = me.hasPermission("admin:users");
  const canManage = me.hasPermission("capacity:manage");
  const { data, isLoading, isError, refetch } = useGetPersonQuery(id);
  const groups = useListGroupsQuery(undefined, { skip: !canAdmin });
  const [patch, { isLoading: patching }] = usePatchPersonMutation();
  const onError = useMutationErrors(refetch);
  const track = useTrack("roster.person.save");
  const [tab, setTab] = useState("details");
  const tabs = useMemo(
    () => [
      { key: "details", label: "Details" },
      { key: "calendar", label: "Calendar" },
      { key: "pto", label: "PTO" },
      { key: "skills", label: "Skills", count: data?.skills.length },
      { key: "certifications", label: "Certifications", count: data?.certifications.length },
    ],
    [data],
  );

  return (
    <>
      {isLoading ? <Skeleton lines={2} className="mb-4 max-w-sm" /> : null}
      {!isLoading && (isError || !data) ? (
        <EmptyBanner title="This person is not on the roster" action={{ label: "Back to Roster", href: "/roster" }} />
      ) : null}
      {data ? (
        <>
          <RecordBar
            keyText={data.email}
            title={data.display_name}
            pill={
              <>
                <span className="text-xms-label text-[13px]">{roleLabel(data.role)}</span>
                {data.is_active ? (
                  <SignalPill tone="complete" label="Active" />
                ) : (
                  <SignalPill tone="blocked" label="Inactive" />
                )}
              </>
            }
            actions={
              canAdmin ? (
                <SwitchRow
                  id="person-active"
                  label="Active"
                  checked={data.is_active}
                  disabled={patching}
                  onChange={async (next) => {
                    try {
                      await patch({ id, body: { version: data.version, is_active: next } }).unwrap();
                      track({ person_id: id, fields: 1, is_active: next });
                    } catch (caught) {
                      onError(caught);
                    }
                  }}
                />
              ) : null
            }
          />
          <TabBar tabs={tabs} active={tab} onChange={setTab} className="mb-4" />
          {tab === "details" ? (
            <DetailsTab person={data} refetch={refetch} canEdit={canAdmin} groups={groups.data} />
          ) : null}
          {tab === "calendar" ? (
            <CalendarTab personId={id} calendar={data.calendar} canEdit={canManage} timeZone={data.time_zone} />
          ) : null}
          {tab === "pto" ? <PtoTab personId={id} userId={data.user_id} canManage={canManage} /> : null}
          {tab === "skills" ? <SkillsTab personId={id} skills={data.skills} canEdit={canManage} /> : null}
          {tab === "certifications" ? (
            <CertificationsTab personId={id} certifications={data.certifications} canEdit={canManage} />
          ) : null}
        </>
      ) : null}
    </>
  );
}

/** Registered as `roster.person`: header with the active switch, then Details, Calendar, PTO, Skills, Certifications. */
export default function PersonRecordPage() {
  return (
    <AdminGate permission="capacity:view">
      <PersonRecordPageBody />
    </AdminGate>
  );
}
