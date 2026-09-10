import { StatePill } from "@/components/xms/state-pill";
import type { ArticleKind, ArticleStatus, EffortBand, SelfService } from "@/redux/knowledgeApi";

/** Article status on the ramp: draft slate, in review amber, published green, retired muted (User Experience 3.7). */
export function ArticleStatusPill({ status }: { status: ArticleStatus }) {
  const ramp: Record<ArticleStatus, string> = {
    draft: "new",
    in_review: "awaiting-client",
    published: "resolved",
    retired: "closed",
  };
  return <StatePill state={ramp[status]} label={STATUS_LABEL[status]} />;
}

export const STATUS_LABEL: Record<ArticleStatus, string> = {
  draft: "Draft",
  in_review: "In review",
  published: "Published",
  retired: "Retired",
};

export const KIND_LABEL: Record<ArticleKind, string> = {
  solution: "Solution",
  workaround: "Workaround",
  known_error: "Known error",
  procedure: "Procedure",
  reference: "Reference",
};

export const SELF_SERVICE_LABEL: Record<SelfService, string> = {
  none: "Not eligible",
  follow: "Client can follow",
  request: "Client can request",
  auto: "Auto-resolvable",
};

export const EFFORT_LABEL: Record<EffortBand, string> = {
  lt_15m: "Under 15 minutes",
  lt_1h: "Under 1 hour",
  lt_4h: "Under 4 hours",
  gt_4h: "Over 4 hours",
};

export function GlobalChip({ isGlobal }: { isGlobal: boolean }) {
  if (!isGlobal) return null;
  return (
    <span className="border-xms-line text-xms-label inline-flex h-[20px] items-center rounded-[999px] border px-2 text-[14px]">
      Global
    </span>
  );
}
