"use client";

import { useMemo, useState } from "react";
import { FieldRow, INPUT, InlineError, PRIMARY_BUTTON, fullName } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import {
  useChangeAccountOwnerMutation,
  useGetAccountGranteesQuery,
  useListUsersQuery,
  type AccountRow,
} from "@/redux/adminApi";

/**
 * The one named primary owner of the account (TM-23), and the handover.
 *
 * The picker offers the people granted the account, because an owner who
 * cannot open it is not an owner and the server refuses that anyway; the
 * refusal is mirrored here rather than decided here. An owner who is not in
 * the grantee list (an administrator, who is bound to every account without
 * a grant row) still shows by name, so the panel never reads as unowned when
 * it is not.
 */
export function AccountOwnerPanel({ account }: { account: AccountRow }) {
  const grantees = useGetAccountGranteesQuery(account.id);
  const internal = useListUsersQuery({ kind: "internal" });
  const [changeOwner, { isLoading: saving }] = useChangeAccountOwnerMutation();
  const track = useTrack("account.owner.change");
  const [choice, setChoice] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map((internal.data ?? []).map((user) => [user.id, user])), [internal.data]);
  const candidates = useMemo(
    () =>
      (grantees.data ?? [])
        .map((grant) => ({
          id: grant.user_id,
          label: fullName(grant) || grant.email,
          email: grant.email,
        }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [grantees.data],
  );

  if (!grantees.data || !internal.data) return <Skeleton lines={4} className="max-w-md" />;

  const current = account.owner_user_id ? byId.get(account.owner_user_id) : undefined;
  const currentName = current
    ? `${fullName(current) || current.email}`
    : account.owner_user_id
      ? "A user outside the directory listing"
      : "Nobody yet";

  return (
    <Panel title="Account owner" caption="One named person answers for this account">
      <p className="mb-3 text-sm">
        <span className="text-muted">Current owner</span> <span className="font-medium">{currentName}</span>
        {current ? <span className="text-muted"> · {current.email}</span> : null}
      </p>
      <form
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            await changeOwner({
              id: account.id,
              version: account.version,
              owner_user_id: choice,
              reason: reason.trim() || undefined,
            }).unwrap();
            track({ account_id: account.id });
            setChoice("");
            setReason("");
          } catch (caught) {
            setError(describeError(apiError(caught)));
          }
        }}
      >
        <FieldRow label="Hand to" htmlFor="owner-choice">
          <select
            id="owner-choice"
            className={INPUT}
            value={choice}
            onChange={(event) => setChoice(event.target.value)}
            required
          >
            <option value="">Choose a person granted this account</option>
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.label} · {candidate.email}
              </option>
            ))}
          </select>
        </FieldRow>
        <FieldRow label="Reason" htmlFor="owner-reason">
          <input
            id="owner-reason"
            className={INPUT}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why the account is moving"
            maxLength={500}
          />
        </FieldRow>
        <InlineError message={error} />
        <div>
          <button type="submit" className={PRIMARY_BUTTON} disabled={saving || !choice}>
            Change owner
          </button>
        </div>
      </form>
      {candidates.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nobody is granted this account yet. Grant somebody on the Access tab before handing it over.
        </p>
      ) : null}
    </Panel>
  );
}
