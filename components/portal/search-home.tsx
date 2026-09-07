"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardStrip } from "@/components/portal/dashboard-strip";
import { PORTAL_INPUT, PORTAL_PRIMARY, PortalCard } from "@/components/portal/primitives";
import { RequestList } from "@/components/portal/request-list";
import { Skeleton } from "@/components/xms/skeleton";
import { useTrack } from "@/lib/telemetry/provider";
import { usePortalTicketsQuery, useSearchArticlesQuery } from "@/redux/portalApi";

/**
 * Search-first home (User Experience 4.2). One box searches solutions and
 * the visitor's own requests; solutions are the placeholder list until the
 * knowledge base ships. Two quiet cards carry the count and the CTA.
 */
export function SearchHome({ debounceMs = 250 }: { debounceMs?: number }) {
  const [term, setTerm] = useState("");
  const [query, setQuery] = useState("");
  const trackSearch = useTrack("portal.search");

  useEffect(() => {
    const handle = setTimeout(() => setQuery(term.trim()), debounceMs);
    return () => clearTimeout(handle);
  }, [term, debounceMs]);

  const matches = usePortalTicketsQuery({ scope: "all", q: query }, { skip: query.length < 2 });
  const articles = useSearchArticlesQuery(query, { skip: query.length < 2 });

  useEffect(() => {
    if (query.length < 2 || matches.isFetching) return;
    trackSearch(
      { scope: "portal", term_length: query.length, result_count: matches.data?.items.length ?? 0 },
      "search.run",
    );
    // The term itself is never sent; only its length and the result count.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, matches.isFetching]);

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="home-title" className="flex flex-col gap-3">
        <h1 id="home-title" className="text-xms-ink text-[24px] font-semibold">
          What do you need help with?
        </h1>
        <label htmlFor="portal-search" className="sr-only">
          Search solutions and your requests
        </label>
        <input
          id="portal-search"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Describe the problem, or paste a request key like CS0001234"
          className={`${PORTAL_INPUT} h-[48px] text-[16px]`}
          autoComplete="off"
        />
        <p className="text-xms-label text-[13px]">
          Published solutions come first; open a request when you still need help.
        </p>
      </section>

      {query.length >= 2 ? (
        <div className="grid gap-4 md:grid-cols-2">
          <PortalCard title="Solutions">
            {articles.data && articles.data.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {articles.data.map((article) => (
                  <li key={article.id} className="text-[14px]">
                    <span className="text-xms-ink font-medium">{article.title}</span>
                    <p className="text-xms-label text-[13px]">{article.summary}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p role="status" className="text-xms-label text-[14px]">
                Knowledge articles will appear here.
              </p>
            )}
          </PortalCard>
          <PortalCard title="Your matching requests">
            {matches.isFetching ? (
              <Skeleton lines={3} />
            ) : (
              <RequestList items={matches.data?.items ?? []} emptyText="No request matches that." />
            )}
          </PortalCard>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <DashboardStrip />
        <PortalCard title="Still need help?">
          <p className="text-xms-body text-[14px]">
            Tell us what is wrong or what you need. You will get a request key by email.
          </p>
          <Link href="/portal/requests/new" className={PORTAL_PRIMARY}>
            New request
          </Link>
        </PortalCard>
      </div>
    </div>
  );
}
