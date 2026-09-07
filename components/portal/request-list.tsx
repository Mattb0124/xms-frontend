"use client";

import Link from "next/link";
import { ClientStatusPill } from "@/components/portal/primitives";
import { priorityLabel, relativeTime } from "@/lib/portal/client-language";
import type { PortalTicket } from "@/redux/portalApi";

/**
 * A simple request list: key in mono, title, client status on the ramp,
 * priority as a word, updated as relative time. Rows are links so the
 * keyboard reaches every request.
 */
export function RequestList({ items, emptyText }: { items: PortalTicket[]; emptyText: string }) {
  if (items.length === 0) {
    return (
      <p role="status" className="text-xms-label py-6 text-center text-[14px]">
        {emptyText}
      </p>
    );
  }
  return (
    <table className="w-full text-[14px]">
      <thead>
        <tr className="text-xms-label border-xms-line border-b text-left text-[12px] uppercase tracking-wide">
          <th scope="col" className="py-2 pr-3 font-medium">
            Request
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Status
          </th>
          <th scope="col" className="py-2 pr-3 font-medium">
            Priority
          </th>
          <th scope="col" className="py-2 font-medium">
            Updated
          </th>
        </tr>
      </thead>
      <tbody>
        {items.map((item) => (
          <tr key={item.id} className="border-xms-line hover:bg-xms-row-hover border-b last:border-b-0">
            <td className="py-3 pr-3">
              <Link
                href={`/portal/requests/${item.key}`}
                className="focus-visible:ring-xms-accent flex flex-col gap-0.5 rounded-[4px] outline-none focus-visible:ring-2"
              >
                <span className="xms-mono text-xms-label text-[12px]">{item.key}</span>
                <span className="text-xms-ink font-medium">{item.short_description}</span>
              </Link>
            </td>
            <td className="py-3 pr-3">
              <ClientStatusPill state={item.state} />
            </td>
            <td className="text-xms-body py-3 pr-3">{priorityLabel(item.priority)}</td>
            <td className="text-xms-label py-3">
              <time dateTime={item.updated_at}>{relativeTime(item.updated_at)}</time>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
