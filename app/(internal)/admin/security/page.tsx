import { AdminGate } from "@/components/admin/primitives";
import { SecurityDashboard } from "@/components/admin/security-dashboard";

/** Registered as `admin.security` (P2.19.4). */
export default function AdminSecurityPage() {
  return (
    <AdminGate permission="audit:read">
      <SecurityDashboard />
    </AdminGate>
  );
}
