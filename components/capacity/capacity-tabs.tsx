"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface CapacityTabsProps {
  active: "capacity" | "variance";
  /** The query string carried across, so the month survives the switch. */
  search?: string;
}

/** The two capacity screens as record-style tabs that are links: Capacity and Planned versus actual. */
export function CapacityTabs({ active, search = "" }: CapacityTabsProps) {
  const tabs = [
    { key: "capacity" as const, label: "Capacity", href: `/capacity${search}` },
    { key: "variance" as const, label: "Planned versus actual", href: `/capacity/variance${search}` },
  ];
  return (
    <nav aria-label="Capacity screens" className="border-xms-line mb-4 flex items-end gap-1 border-b">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={selected ? "page" : undefined}
            className={cn(
              "-mb-px flex h-[36px] items-center border-b-2 px-3 text-[13px] hover:no-underline",
              selected ? "border-xms-accent text-xms-ink font-medium" : "text-xms-label hover:text-xms-ink border-transparent",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
