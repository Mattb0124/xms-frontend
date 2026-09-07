"use client";

import { useParams } from "next/navigation";
import { AdminGate } from "@/components/admin/primitives";
import { ReportPackView } from "@/components/reporting/report-pack";

/** Registered as `report_pack` (P2.20.2 cut): the frozen numbers and the narrative of one pack. */
export default function ReportPackPage() {
  const params = useParams<{ id: string }>();
  return (
    <AdminGate permission="tickets:view">
      <ReportPackView packId={params.id} />
    </AdminGate>
  );
}
