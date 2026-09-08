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
  {
    screen: "admin.api_clients",
    detail: "Machine identities: name, scopes, granted accounts, expiry, the key shown once, revoke.",
  },
  { screen: "admin.config", detail: "State machines, priority matrix, SLA policy and the catalogs." },
  { screen: "admin.holiday_calendars", detail: "Country holiday sets shared by account and person calendars." },
  { screen: "roster", detail: "People, roles, FTE, time zones, working calendars, skills and certifications." },
  {
    screen: "admin.connectors",
    detail: "Every ServiceNow instance: health, mode, kill switch, maps, runs, dead letters with replay and discard.",
  },
  {
    screen: "admin.migration",
    detail: "Batches with dry runs and re-runs, per-record results, reconciliation with explanations and sign-off.",
  },
  { screen: "admin.audit", detail: "One search over audit, security and usage events, with the request pivot." },
  { screen: "admin.security", detail: "Sign-in failures, denials, isolation probes, admin changes." },
  { screen: "admin.usage", detail: "Active users, top actions and screens, searches with no result, API errors." },
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
      <EmptyBanner
        title="Not permitted"
        detail="Administration needs the admin:accounts, admin:users, admin:api-clients, admin:config, admin:connectors, admin:migration, capacity:view, audit:read or analytics:read permission."
      />
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {visible.map((card) => (
        <Panel key={card.screen} title={card.entry.label} caption={card.entry.section}>
          <p className="text-xms-body mb-3 text-[13px]">{card.detail}</p>
          <Link href={card.entry.path} className="text-xms-accent text-[13px] font-medium">
            Open {card.entry.label.toLowerCase()}
          </Link>
        </Panel>
      ))}
    </div>
  );
}
