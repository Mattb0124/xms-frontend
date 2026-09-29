"use client";

import { Suspense } from "react";
import { AdminGate } from "@/components/admin/primitives";
import { ReportPacksList } from "@/components/reporting/report-packs-list";
import { Skeleton } from "@/components/xms/skeleton";

/**
 * Registered as `report_packs` (DR-08): every run of every schedule, newest
 * first. The route registry has always named this screen and nothing served
 * it, so it stood in the finder as a dead link.
 */
export default function ReportPacksPage() {
  return (
    <AdminGate permission="reports:manage">
      <Suspense fallback={<Skeleton lines={8} />}>
        <ReportPacksList />
      </Suspense>
    </AdminGate>
  );
}
