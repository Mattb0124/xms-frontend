"use client";

import { SignalPill } from "@/components/xms/signal-pill";
import { expiringEngagements, renewalChipLabel, renewalChipTitle, renewalChipTone } from "@/lib/contracts/engagements";
import { useMe } from "@/redux/me";
import { useListEngagementsQuery } from "@/redux/ticketsApi";

/**
 * The renewal chips on the account dashboard header (Time, Contracts &
 * Budget technical 2.1): one per engagement the server marked `expiring`,
 * saying which engagement renews and how many days are left, and turning
 * from amber to red once the notice period has been entered, because past
 * that boundary the decision is already late.
 *
 * Needs contracts:view, the permission the API puts on the engagements
 * route, and the API is not asked without it. An account with nothing
 * expiring renders nothing at all, so a healthy header carries no noise.
 */
export function AccountRenewalChips({ accountId }: { accountId: string }) {
  const me = useMe();
  const allowed = me.hasPermission("contracts:view");
  const { data } = useListEngagementsQuery(accountId, { skip: !allowed });
  const expiring = expiringEngagements(data);
  if (expiring.length === 0) return null;
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-2"
      role="list"
      aria-label="Renewals"
      data-testid="renewal-chips"
    >
      {expiring.map((engagement) => (
        <span key={engagement.id} role="listitem" data-renewal={engagement.id}>
          <SignalPill
            tone={renewalChipTone(engagement)}
            label={renewalChipLabel(engagement)}
            title={renewalChipTitle(engagement)}
          />
        </span>
      ))}
    </div>
  );
}
