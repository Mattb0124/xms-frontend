"use client";

import Link from "next/link";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { Panel } from "@/components/xms/panel";
import { Skeleton } from "@/components/xms/skeleton";
import { SCREENS } from "@/lib/routes";
import { useMe } from "@/redux/me";

const CARDS = [
  { screen: "admin.accounts", detail: "Create accounts, edit settings, grant access, invite portal users." },
  { screen: "admin.users", detail: "Invite internal users, assign roles, reconcile account grants." },
  { screen: "admin.roles", detail: "Operator and portal role catalogs with their implications." },
  { screen: "admin.groups", detail: "Assignment groups, leads and members." },
  { screen: "admin.config", detail: "State machines, priority matrix, SLA policy and the catalogs." },
];

/** Registered as `admin`: cards into each section, gated per card by its permission (fail closed). */
export default function AdminPage() {
  const me = useMe();
  if (!me.permissions) return <Skeleton lines={4} className="max-w-md" />;
  const visible = CARDS.map((card) => ({ ...card, entry: SCREENS.find((s) => s.screen === card.screen)! })).filter(
    (card) => card.entry.permission === null || me.hasPermission(card.entry.permission),
  );
  if (visible.length === 0) {
    return (
      <EmptyBanner title="Not permitted" detail="Administration needs the admin:accounts or admin:users permission." />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((card) => (
        <Panel key={card.screen} title={card.entry.label} caption="Admin">
          <p className="text-xms-body mb-3 text-[13px]">{card.detail}</p>
          <Link href={card.entry.path} className="text-xms-accent text-[13px] font-medium">
            Open {card.entry.label.toLowerCase()}
          </Link>
        </Panel>
      ))}
    </div>
  );
}
