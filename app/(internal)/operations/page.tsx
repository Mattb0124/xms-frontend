import { AdminGate } from "@/components/admin/primitives";
import { OperationsDashboard } from "@/components/reporting/operations-dashboard";

/** Registered as `operations` (P2.19.3): the portfolio dashboard for reports:view-portfolio. */
export default function OperationsPage() {
  return (
    <AdminGate permission="reports:view-portfolio">
      <OperationsDashboard />
    </AdminGate>
  );
}
