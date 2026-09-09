"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { ICON, BookIcon } from "@/components/xms/icons";
import { KeyLink } from "@/components/xms/key-link";
import { RailCard } from "@/components/xms/rail-card";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { useMe } from "@/redux/me";
import {
  useArticleCandidateMutation,
  useLinkSolutionMutation,
  useTicketSolutionsQuery,
  type SolutionLink,
} from "@/redux/knowledgeApi";

const OUTCOME_LABEL: Record<SolutionLink["outcome"], string> = {
  resolved_by: "Resolved by",
  partially_resolved_by: "Partially resolved by",
  created_from: "Article created from this ticket",
};

/**
 * The Solutions rail (Knowledge Base 5.3): matching published articles with
 * "Use this", similar resolved tickets with their article, the resolution
 * records already on the ticket, and the candidate action.
 */
export function SolutionsRail({ ticketKey, readOnly }: { ticketKey: string; readOnly?: boolean }) {
  const { data, isLoading } = useTicketSolutionsQuery(ticketKey);
  const [link, linking] = useLinkSolutionMutation();
  const [candidate, proposing] = useArticleCandidateMutation();
  const me = useMe();
  const router = useRouter();
  const { push } = useToast();
  const trackLink = useTrack("solution.link");
  const [error, setError] = useState<string | null>(null);

  const applySolution = async (articleId: string) => {
    setError(null);
    try {
      const result = await link({ ticketKey, article_id: articleId }).unwrap();
      trackLink({ article_id: articleId });
      push({ title: `${result.article.key} linked as the solution`, tone: "success" });
    } catch (caught) {
      const parsed = apiError(caught);
      setError(parsed.code === "article_not_published" ? "That article is not published." : describeError(parsed));
    }
  };

  const propose = async () => {
    setError(null);
    try {
      const draft = await candidate({ ticketKey, include_work_notes: true }).unwrap();
      push({ title: `${draft.display_key} drafted from ${ticketKey}`, tone: "success" });
      router.push(`/knowledge/${draft.display_key}`);
    } catch (caught) {
      setError(describeError(apiError(caught)));
    }
  };

  const canResolve = me.hasPermission("tickets:resolve");
  const canAuthor = me.hasPermission("kb:author");

  return (
    <RailCard
      // The prototype's own card: "Similar solutions" on the note ground with
      // a 15px book before the eyebrow, which is the one rail card it does not
      // stand on white.
      caption="Similar solutions"
      tone="note"
      glyph={<BookIcon size={ICON.action} className="text-xms-label shrink-0" />}
      action={
        !readOnly && canAuthor ? (
          <button type="button" onClick={() => void propose()} disabled={proposing.isLoading} className="xms-link">
            Propose an article
          </button>
        ) : null
      }
    >
      {isLoading || !data ? (
        <Skeleton lines={4} />
      ) : (
        <div className="flex flex-col gap-3">
          {data.linked.length > 0 ? (
            <ul className="flex flex-col gap-1" aria-label="Resolution records">
              {data.linked.map((row) => (
                <li key={row.id} className="flex flex-col text-[12px]" data-outcome={row.outcome}>
                  <span className="text-xms-label">{OUTCOME_LABEL[row.outcome]}</span>
                  <span className="flex items-center gap-2">
                    <KeyLink ticketKey={row.display_key} href={`/knowledge/${row.display_key}`} />
                    <span className="text-xms-ink truncate">{row.title}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <div>
            <p className="text-xms-label mb-1 text-[11px] uppercase tracking-wide">Matching articles</p>
            {data.articles.length === 0 ? (
              <p className="text-xms-muted text-[12px]">
                No documented solution yet. Resolving this ticket will create the first one.
              </p>
            ) : (
              <ul className="flex flex-col gap-2" aria-label="Matching articles">
                {data.articles.map((hit) => (
                  <li key={hit.id} className="flex flex-col gap-1 text-[12px]">
                    <span className="flex items-center gap-2">
                      <KeyLink ticketKey={hit.display_key} href={`/knowledge/${hit.display_key}`} />
                      <span className="text-xms-ink truncate">{hit.title}</span>
                      {hit.is_global ? <span className="text-xms-label ml-auto text-[11px]">Global</span> : null}
                    </span>
                    <span className="flex gap-2">
                      {!readOnly && canResolve ? (
                        <button
                          type="button"
                          aria-label={`Use ${hit.display_key}`}
                          disabled={linking.isLoading}
                          onClick={() => void applySolution(hit.id)}
                          className={`${PRIMARY_BUTTON} h-[26px] px-2 text-[12px]`}
                        >
                          Use this
                        </button>
                      ) : null}
                      <Link
                        href={`/knowledge/${hit.display_key}`}
                        className={`${SECONDARY_BUTTON} inline-flex h-[26px] items-center px-2 text-[12px]`}
                      >
                        Open
                      </Link>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {data.similar_tickets.length > 0 ? (
            <div>
              <p className="text-xms-label mb-1 text-[11px] uppercase tracking-wide">Similar resolved tickets</p>
              <ul className="flex flex-col gap-1" aria-label="Similar resolved tickets">
                {data.similar_tickets.map((row) => (
                  <li key={row.id} className="flex flex-col text-[12px]">
                    <span className="flex items-center gap-2">
                      <KeyLink ticketKey={row.key} />
                      <span className="text-xms-ink truncate">{row.short_description}</span>
                    </span>
                    <span className="text-xms-label">
                      {row.resolution_code ? row.resolution_code.replace(/_/g, " ") : "no code"}
                      {row.article_key ? (
                        <>
                          {" via "}
                          <KeyLink
                            ticketKey={row.article_key}
                            href={`/knowledge/${row.article_key}`}
                            className="text-[12px]"
                          />
                        </>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {error ? (
            <p role="alert" className="text-[12px] text-[color:var(--state-overdue-text)]">
              {error}
            </p>
          ) : null}
        </div>
      )}
    </RailCard>
  );
}
