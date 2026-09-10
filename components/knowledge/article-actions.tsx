"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmButton, INPUT, PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import { useTrack } from "@/lib/telemetry/provider";
import { SECTION_LABEL } from "@/components/knowledge/article-editor";
import { useMe } from "@/redux/me";
import {
  useGeneralizeArticleMutation,
  usePublishArticleMutation,
  useRetireArticleMutation,
  useSubmitArticleMutation,
  type ArticleView,
  type Finding,
  type VersionSection,
} from "@/redux/knowledgeApi";

/** The copy for a publish or generalize refusal, by code (Knowledge Base 5.5, 5.6). */
export function describeArticleError(error: ApiError & { items?: string[]; findings?: Finding[] }): string {
  switch (error.code) {
    case "reviewer_must_differ":
      return "The reviewer must be someone other than the author of this draft.";
    case "missing_requirements":
      return `Fill in ${(error.items ?? []).map((item) => SECTION_LABEL[item as VersionSection] ?? item).join(" and ")} before publishing.`;
    case "generalization_findings":
      return "The text still carries identifiers; see the generalization findings.";
    case "nothing_to_publish":
      return "There is no unpublished draft to publish.";
    case "nothing_to_generalize":
      return "There is no text to generalize yet.";
    case "article_retired":
      return "A retired article cannot change.";
    case "global_article":
      return "A global article has no visibility set.";
    default:
      return describeError(error);
  }
}

const FINDING_LABEL: Record<string, string> = {
  account_name: "Account name",
  contact_name: "Contact name",
  email: "Email address",
  hostname: "Hostname",
  ip_address: "IP address",
  attachment: "Attachment reference",
};

/** The findings list from the identifier checklist: section, kind and the offending value. */
export function FindingsSheet({ findings, onClose }: { findings: Finding[]; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="Generalization findings" className="xms-card flex flex-col gap-3 p-4 text-[14px]">
      <p className="xms-caption">Generalization findings</p>
      <p className="text-xms-ink">
        Remove these identifiers from the sections named, then generalize again. The account-specific article stays as
        it is.
      </p>
      <ul className="divide-xms-line divide-y" aria-label="Findings">
        {findings.map((finding, index) => (
          <li key={index} className="flex items-center gap-3 py-1.5" data-kind={finding.kind}>
            <span className="text-xms-label w-[150px]">
              {SECTION_LABEL[finding.section as VersionSection] ?? finding.section}
            </span>
            <span className="text-xms-body w-[150px]">{FINDING_LABEL[finding.kind] ?? finding.kind}</span>
            <span className="xms-mono text-xms-ink">{finding.value}</span>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <button type="button" onClick={onClose} className={SECONDARY_BUTTON}>
          Close
        </button>
      </div>
    </div>
  );
}

/** Submit, Publish, Retire and Generalize with their refusals rendered inline. */
export function ArticleActions({ article }: { article: ArticleView }) {
  const me = useMe();
  const router = useRouter();
  const { push } = useToast();
  const trackPublish = useTrack("article.publish");
  const [submit, submitting] = useSubmitArticleMutation();
  const [publish, publishing] = usePublishArticleMutation();
  const [retire, retiring] = useRetireArticleMutation();
  const [generalize, generalizing] = useGeneralizeArticleMutation();
  const [error, setError] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [retireReason, setRetireReason] = useState("");
  const [retireOpen, setRetireOpen] = useState(false);

  const canAuthor = me.hasPermission("kb:author");
  const canPublish = me.hasPermission("kb:publish");
  const retired = article.status === "retired";
  const hasDraft = article.draft !== null;

  const run = async (action: () => Promise<unknown>, done?: string) => {
    setError(null);
    try {
      await action();
      if (done) push({ title: done, tone: "success" });
    } catch (caught) {
      const parsed = apiError(caught) as ApiError & { items?: string[]; findings?: Finding[] };
      const data = (caught as { data?: { items?: string[]; findings?: Finding[] } })?.data;
      if (data?.findings) setFindings(data.findings);
      setError(describeArticleError({ ...parsed, items: data?.items, findings: data?.findings }));
    }
  };

  return (
    <div className="flex flex-col gap-2" data-testid="article-actions">
      <div className="flex flex-wrap items-center gap-2">
        {canAuthor && article.status === "draft" && hasDraft ? (
          <button
            type="button"
            disabled={submitting.isLoading}
            onClick={() =>
              void run(
                () => submit({ key: article.display_key, version: article.version }).unwrap(),
                "Submitted for review",
              )
            }
            className={SECONDARY_BUTTON}
          >
            Submit for review
          </button>
        ) : null}
        {canPublish && !retired && hasDraft ? (
          <button
            type="button"
            disabled={publishing.isLoading}
            onClick={() =>
              void run(async () => {
                const view = await publish({ key: article.display_key, version: article.version }).unwrap();
                trackPublish({ article_id: view.id, version_no: view.published?.version_no ?? 0 });
              }, `${article.display_key} published`)
            }
            className={PRIMARY_BUTTON}
          >
            Publish
          </button>
        ) : null}
        {canPublish && !retired && !article.is_global ? (
          <button
            type="button"
            disabled={generalizing.isLoading}
            onClick={() =>
              void run(async () => {
                const result = await generalize({ key: article.display_key }).unwrap();
                if ("findings" in result) {
                  setFindings(result.findings);
                  return;
                }
                push({ title: `${result.display_key} drafted as the global copy`, tone: "success" });
                router.push(`/knowledge/${result.display_key}`);
              })
            }
            className={SECONDARY_BUTTON}
          >
            Generalize
          </button>
        ) : null}
        {canPublish && !retired ? (
          <button type="button" onClick={() => setRetireOpen((open) => !open)} className={SECONDARY_BUTTON}>
            Retire
          </button>
        ) : null}
      </div>
      {retireOpen ? (
        <form
          aria-label="Retire article"
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void run(
              () =>
                retire({ key: article.display_key, version: article.version, reason: retireReason.trim() }).unwrap(),
              `${article.display_key} retired`,
            ).then(() => setRetireOpen(false));
          }}
        >
          <label className="flex flex-col gap-1 text-[14px]">
            <span className="text-xms-label">Reason</span>
            <input
              aria-label="Retire reason"
              value={retireReason}
              onChange={(event) => setRetireReason(event.target.value)}
              className={`${INPUT} w-[320px]`}
            />
          </label>
          <ConfirmButton
            label="Retire this article"
            confirmLabel="Confirm retire"
            danger
            disabled={retireReason.trim().length < 3 || retiring.isLoading}
            onConfirm={() =>
              run(
                () =>
                  retire({ key: article.display_key, version: article.version, reason: retireReason.trim() }).unwrap(),
                `${article.display_key} retired`,
              ).then(() => setRetireOpen(false))
            }
          />
        </form>
      ) : null}
      {error ? (
        <p role="alert" className="text-[14px] text-[color:var(--state-overdue-text)]">
          {error}
        </p>
      ) : null}
      {findings ? <FindingsSheet findings={findings} onClose={() => setFindings(null)} /> : null}
    </div>
  );
}
