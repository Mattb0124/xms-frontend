"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export type CapacityTab = "capacity" | "variance" | "skills" | "demand";

export interface CapacityTabsProps {
  active: CapacityTab;
  /** The query string carried across the month screens, so the month survives the switch. */
  search?: string;
}

/** The capacity screens as record-style tabs that are links: Capacity, Planned versus actual, the Skills matrix and Demand. */
export function CapacityTabs({ active, search = "" }: CapacityTabsProps) {
  const tabs: { key: CapacityTab; label: string; href: string }[] = [
    { key: "capacity", label: "Capacity", href: `/capacity${search}` },
    { key: "variance", label: "Planned versus actual", href: `/capacity/variance${search}` },
    { key: "skills", label: "Skills matrix", href: "/capacity/skills" },
    { key: "demand", label: "Demand", href: "/capacity/demand" },
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
