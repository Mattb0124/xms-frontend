"use client";

import { useParams } from "next/navigation";
import { AdminGate } from "@/components/admin/primitives";
import { ReportRunReview } from "@/components/reporting/run-review";

/**
 * Registered as `report_run` (Dashboards functional 5.8, DR-05): one held
 * report run, read and decided before anything reaches a client. The three
 * routes behind it all stand on `reports:manage`, and the gate holds a child
 * so nothing is asked before the browser has decided.
 */
export default function ReportRunPage() {
  const params = useParams<{ id: string }>();
  return (
    <AdminGate permission="reports:manage">
      <ReportRunReview runId={params.id} />
    </AdminGate>
  );
}
