"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { ConfirmButton } from "@/components/admin/primitives";
import { ArticleStatusPill, GlobalChip } from "@/components/knowledge/primitives";
import { DenseTable, type DenseColumn } from "@/components/xms/dense-table";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { KeyLink } from "@/components/xms/key-link";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { useListArrangement } from "@/components/xms/use-list-arrangement";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useMe } from "@/redux/me";
import { useListArticlesQuery, usePublishArticleMutation, type Article } from "@/redux/knowledgeApi";

const KIND_LABEL: Record<string, string> = {
  solution: "Solution",
  workaround: "Workaround",
  known_error: "Known error",
  procedure: "Procedure",
  reference: "Reference",
};

/**
 * The review queue (User Experience 3.7): the articles somebody has
 * submitted and nobody has published yet.
 *
 * The route registry has always named this screen and nothing served it, so
 * "Review queue" stood in the finder as a dead link and a submitted article
 * could only be found by narrowing the Solutions list by hand.
 *
 * Publishing is done from the row, because the point of a queue is
 * clearing it and a reviewer who has read an article should not have to
 * open it again to say yes. Every other decision opens the record: retiring
 * records a reason, and sending something back is a change to the draft.
 * Neither has anywhere to be written in a table row.
 */
export function KnowledgeReviewQueue() {
  const router = useRouter();
  const me = useMe();
  const allowed = me.hasPermission("kb:publish");
  const { data, isLoading, isError } = useListArticlesQuery({ status: ["in_review"] }, { skip: !allowed });
  const [publish] = usePublishArticleMutation();
  const { push } = useToast();

  const failed = (caught: unknown, title: string) =>
    push({ title, detail: describeError(apiError(caught)), tone: "error" });

  const authored: DenseColumn<Article>[] = useMemo(
    () => [
      {
        key: "key",
        title: "Key",
        mono: true,
        width: "110px",
        sortValue: (row) => row.display_key,
        render: (row) => <KeyLink ticketKey={row.display_key} href={`/knowledge/${row.display_key}`} />,
      },
      {
        key: "title",
        title: "Title",
        wrap: true,
        sortValue: (row) => row.title,
        render: (row) => (
          <span className="flex items-center gap-2">
            <span className="text-xms-ink">{row.title}</span>
            <GlobalChip isGlobal={row.is_global} />
          </span>
        ),
      },
      {
        key: "kind",
        title: "Kind",
        width: "130px",
        sortValue: (row) => row.kind,
        render: (row) => KIND_LABEL[row.kind] ?? row.kind,
      },
      {
        key: "status",
        title: "Status",
        width: "130px",
        sortValue: (row) => row.status,
        render: (row) => <ArticleStatusPill status={row.status} />,
      },
      { key: "owner", title: "Owner", width: "170px", sortValue: (row) => row.owner_name },
      {
        key: "waiting",
        title: "Waiting since",
        width: "130px",
        mono: true,
        sortValue: (row) => row.updated_at,
        render: (row) => row.updated_at.slice(0, 10),
      },
      {
        key: "decide",
        title: "",
        width: "200px",
        render: (row) => (
          <span className="flex items-center gap-2">
            <ConfirmButton
              label="Publish"
              onConfirm={async () => {
                try {
                  await publish({ key: row.display_key, version: row.version }).unwrap();
                  push({ title: `${row.display_key} published`, tone: "success" });
                } catch (caught) {
                  failed(caught, "It was not published");
                }
              }}
            />
            {/* Retiring records why, so it is taken on the record where
                there is somewhere to write the reason. Publishing needs no
                reason, which is why it can be done from the row. */}
            <KeyLink ticketKey="Open" href={`/knowledge/${row.display_key}`} />
          </span>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [publish],
  );

  const arrangement = useListArrangement("knowledge-review", authored);

  if (!allowed) {
    return (
      <EmptyBanner
        title="Not permitted"
        detail="The review queue needs the kb:publish permission, which is what publishing an article stands on."
      />
    );
  }

  if (isLoading && !data) return <Skeleton lines={6} />;
  if (isError) return <EmptyBanner title="The queue could not be read" detail="Try again in a moment." />;

  return (
    <>
      <DenseTable<Article>
        title="Review queue"
        columns={arrangement.columns}
        display={arrangement.display}
        rows={data ?? []}
        rowKey={(row) => row.display_key}
        defaultSort={{ key: "waiting", direction: "asc" }}
        onRowClick={(row) => router.push(`/knowledge/${row.display_key}`)}
        emptyState="Nothing is waiting to be published. Submitted articles land here."
      />
      {arrangement.dialogue}
    </>
  );
}
