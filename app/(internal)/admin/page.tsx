"use client";

import Link from "next/link";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { ICON, screenIcon } from "@/components/xms/icons";
import { Skeleton } from "@/components/xms/skeleton";
import { SCREENS, type Section } from "@/lib/routes";
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

/**
 * Registered as `admin`, gated per row by its own permission (fail closed).
 *
 * This was thirteen cards in a three-column grid, each with an eyebrow
 * reading ADMIN, a title, a sentence, and a link repeating the title ("Open
 * accounts admin"). Render 12 already settled what a list of screens looks
 * like in this product: a section heading, then a row per screen carrying its
 * own icon and its name and nothing that repeats them. This is that list on a
 * card, with the purpose beside the name and the whole row as the link.
 */
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
  const sections = [...new Set(visible.map((card) => card.entry.section))] as Section[];
  return (
    <section className="xms-card flex min-w-0 flex-col" aria-label="Administration">
      <header className="border-xms-line flex min-h-[48px] flex-wrap items-center gap-[14px] border-b px-5 py-3">
        <span className="text-xms-ink text-[17px] leading-[1.3] font-semibold">Administration</span>
        <span className="text-xms-muted -ml-[6px] text-[13px]">every screen your permissions open</span>
      </header>
      {sections.map((section) => (
        <div key={section}>
          <h2 className="text-xms-label bg-xms-quiet-bg border-xms-line-row border-b px-5 py-[9px] text-[11px] font-semibold tracking-[0.06em] uppercase">
            {section}
          </h2>
          <ul>
            {visible
              .filter((card) => card.entry.section === section)
              .map((card) => {
                const Glyph = screenIcon(card.entry.screen);
                return (
                  <li key={card.screen} className="border-xms-line-row border-b last:border-b-0">
                    <Link
                      href={card.entry.path}
                      className="hover:bg-xms-row-hover flex items-center gap-[10px] px-5 py-[13px] hover:no-underline"
                    >
                      <Glyph size={ICON.row} className="text-xms-label shrink-0" />
                      <span className="text-xms-ink shrink-0 text-[13px] font-medium">{card.entry.label}</span>
                      <span className="text-xms-body truncate text-[13px]">{card.detail}</span>
                    </Link>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}
