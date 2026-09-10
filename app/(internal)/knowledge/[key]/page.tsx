"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { AdminGate, RecordBar, formatDate } from "@/components/admin/primitives";
import { ArticleActions } from "@/components/knowledge/article-actions";
import { ArticleEditor } from "@/components/knowledge/article-editor";
import {
  ArticleStatusPill,
  EFFORT_LABEL,
  GlobalChip,
  KIND_LABEL,
  SELF_SERVICE_LABEL,
} from "@/components/knowledge/primitives";
import { VisibilityTab } from "@/components/knowledge/visibility-tab";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { TextLink } from "@/components/xms/key-link";
import { Panel } from "@/components/xms/panel";
import { RailCard } from "@/components/xms/rail-card";
import { RecordForm } from "@/components/xms/record-form";
import { Skeleton } from "@/components/xms/skeleton";
import { TabBar } from "@/components/xms/tab-bar";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useMe } from "@/redux/me";
import {
  useGetArticleQuery,
  useUpdateDraftMutation,
  type ArticleView,
  type EffortBand,
  type Sections,
  type SelfService,
} from "@/redux/knowledgeApi";

const TABS = [
  { key: "content", label: "Content" },
  { key: "visibility", label: "Visibility" },
  { key: "history", label: "History" },
  { key: "feedback", label: "Feedback" },
];

function PropertiesRail({
  article,
  canEdit,
  onCommit,
}: {
  article: ArticleView;
  canEdit: boolean;
  onCommit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const { push } = useToast();
  return (
    <RailCard caption="Properties">
      <RecordForm
        columns={1}
        fields={[
          { key: "kind", label: "Kind", value: KIND_LABEL[article.kind], readOnly: true },
          { key: "categories", label: "Categories", value: article.categories.join(", "), readOnly: !canEdit },
          {
            key: "self_service",
            label: "Self-service",
            value: article.self_service,
            kind: "select",
            readOnly: !canEdit,
            options: (Object.keys(SELF_SERVICE_LABEL) as SelfService[]).map((value) => ({
              value,
              label: SELF_SERVICE_LABEL[value],
            })),
          },
          {
            key: "effort_band",
            label: "Effort",
            value: article.effort_band ?? "",
            kind: "select",
            readOnly: !canEdit,
            options: [
              { value: "", label: "Not set" },
              ...(Object.keys(EFFORT_LABEL) as EffortBand[]).map((value) => ({ value, label: EFFORT_LABEL[value] })),
            ],
          },
          { key: "owner", label: "Owner", value: article.owner_name, readOnly: true },
          { key: "reviewer", label: "Reviewer", value: article.reviewer_name ?? "", readOnly: true },
          {
            key: "verified",
            label: "Last verified",
            value: formatDate(article.last_verified_at),
            readOnly: true,
            mono: true,
          },
        ]}
        onCommit={async (key, value) => {
          if (key === "categories") {
            await onCommit({
              categories: value
                .split(",")
                .map((item) => item.trim())
                .filter(Boolean),
            });
          } else if (key === "effort_band") await onCommit({ effort_band: value || undefined });
          else await onCommit({ [key]: value });
        }}
        onRollback={(_key, _restored, error) =>
          push({ title: "Not saved", detail: describeError(apiError(error)), tone: "error" })
        }
      />
      {article.source_ticket_id ? <p className="text-xms-label mt-3 text-[14px]">Created from a ticket.</p> : null}
      {article.generalized_from_id ? (
        <p className="text-xms-label mt-1 text-[14px]">Generalized from an account article.</p>
      ) : null}
      {article.retired_reason ? (
        <p className="text-xms-label mt-1 text-[14px]">Retired: {article.retired_reason}</p>
      ) : null}
    </RailCard>
  );
}

/** The article record (User Experience 3.7, Knowledge Base 5.4): editor with the fixed sections, rail, tabs. */
function ArticleRecord({ articleKey }: { articleKey: string }) {
  const { data: article, isLoading, isError } = useGetArticleQuery(articleKey);
  const [updateDraft] = useUpdateDraftMutation();
  const me = useMe();
  const { push } = useToast();
  const [tab, setTab] = useState("content");
  const [showPublished, setShowPublished] = useState(false);

  if (isLoading) return <Skeleton lines={10} />;
  if (isError || !article) {
    return (
      <EmptyBanner
        title={`${articleKey} is not visible to you`}
        action={{ label: "Back to Solutions", href: "/knowledge" }}
      />
    );
  }
  const owned = me.grantedAccounts.includes(article.account_id) || article.is_global;
  const canEdit = me.hasPermission("kb:author") && article.status !== "retired" && owned;
  const commit = async (body: Record<string, unknown>) => {
    await updateDraft({ key: article.display_key, body: { version: article.version, ...body } }).unwrap();
  };
  const commitSections = async (sections: Sections) => {
    try {
      await commit(sections);
    } catch (caught) {
      push({ title: "Not saved", detail: describeError(apiError(caught)), tone: "error" });
      throw caught;
    }
  };
  const editingPublished = article.status === "published" && article.published !== null;
  const shownVersion = showPublished && article.published ? article.published : (article.draft ?? article.published);
  const readOnly = !canEdit || (showPublished && editingPublished);

  return (
    <div className="flex flex-col gap-4" data-article={article.display_key}>
      <RecordBar
        keyText={article.display_key}
        title=""
        pill={
          <span className="flex items-center gap-2">
            <ArticleStatusPill status={article.status} />
            <GlobalChip isGlobal={article.is_global} />
            <span className="text-xms-label text-[14px]">{KIND_LABEL[article.kind]}</span>
          </span>
        }
        actions={<ArticleActions article={article} />}
      />
      <div>
        <RecordForm
          columns={1}
          fields={[{ key: "title", label: "Title", value: article.title, readOnly: !canEdit }]}
          onCommit={async (_key, value) => commit({ title: value })}
          onRollback={(_key, _restored, error) =>
            push({ title: "Not saved", detail: describeError(apiError(error)), tone: "error" })
          }
        />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
        <Panel title="Article" flush>
          <div className="px-4 pt-2">
            <TabBar tabs={TABS} active={tab} onChange={setTab} />
          </div>
          <div className="p-4">
            {tab === "content" ? (
              <div className="flex flex-col gap-4">
                {editingPublished && article.draft ? (
                  <div
                    className="border-xms-line bg-xms-tint flex items-center gap-3 rounded-[6px] border px-3 py-2 text-[14px]"
                    data-testid="draft-banner"
                  >
                    <span className="text-xms-ink">
                      Draft v{article.draft.version_no} (unpublished). Published v{article.published?.version_no} stays
                      live until you publish.
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowPublished((value) => !value)}
                      className="text-xms-accent ml-auto hover:underline"
                    >
                      {showPublished ? "Edit the draft" : `Show published v${article.published?.version_no}`}
                    </button>
                  </div>
                ) : null}
                {editingPublished && !article.draft ? (
                  <p className="text-xms-label text-[14px]">
                    Published v{article.published?.version_no}. Editing any section starts draft v
                    {article.versions.length + 1}.
                  </p>
                ) : null}
                <ArticleEditor version={shownVersion} readOnly={readOnly} onCommit={commitSections} />
              </div>
            ) : null}
            {tab === "visibility" ? <VisibilityTab article={article} /> : null}
            {tab === "history" ? (
              <ul className="divide-xms-line divide-y text-[14px]" aria-label="Versions">
                {article.versions.map((version) => (
                  <li key={version.id} className="flex items-center gap-3 py-2">
                    <span className="xms-mono text-xms-ink w-[60px]">v{version.version_no}</span>
                    <span className="text-xms-body">
                      {version.published_at ? `Published ${formatDate(version.published_at)}` : "Draft"}
                    </span>
                    <span className="text-xms-label ml-auto text-[14px]">{version.authored_name}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {tab === "feedback" ? (
              <dl className="grid grid-cols-[160px_1fr] gap-y-2 text-[14px]" aria-label="Feedback counts">
                {(["useful", "not_useful", "out_of_date", "solved_it"] as const).map((verdict) => (
                  <div key={verdict} className="contents">
                    <dt className="text-xms-label">{verdict.replace(/_/g, " ")}</dt>
                    <dd className="xms-mono text-xms-ink">{article.feedback[verdict] ?? 0}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </div>
        </Panel>
        <div className="flex flex-col gap-4">
          <PropertiesRail article={article} canEdit={canEdit} onCommit={commit} />
          {article.source_ticket_id ? (
            <RailCard caption="Origin">
              <TextLink href={`/cases/${article.source_ticket_id}`}>Source ticket</TextLink>
            </RailCard>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default function ArticlePage() {
  const params = useParams<{ key: string }>();
  const key = String(params.key ?? "").toUpperCase();
  return (
    <AdminGate permission="tickets:view">
      <ArticleRecord articleKey={key} />
    </AdminGate>
  );
}
