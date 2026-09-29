import { AdminGate } from "@/components/admin/primitives";
import { AuditSearch } from "@/components/admin/audit-search";

/** Registered as `admin.audit` (P2.11.5): one search over every event of every request. */
export default function AdminAuditPage() {
  return (
    <AdminGate permission="audit:read">
      <AuditSearch />
    </AdminGate>
  );
}
