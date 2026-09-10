"use client";

import { AdminGate } from "@/components/admin/primitives";
import { KnowledgeReviewQueue } from "@/components/knowledge/review-queue";

/**
 * Registered as `solutions_review`: the articles awaiting publication. The
 * route registry has always named this screen and nothing served it, so it
 * stood in the finder as a dead link and a 500 on the article record's
 * dynamic route.
 */
export default function KnowledgeReviewPage() {
  return (
    <AdminGate permission="kb:publish">
      <KnowledgeReviewQueue />
    </AdminGate>
  );
}
