import { AdminGate } from "@/components/admin/primitives";
import { AccountsList } from "@/components/reporting/accounts-list";

/** Registered as `accounts`: the granted accounts with their open counts. */
export default function AccountsPage() {
  return (
    <AdminGate permission="tickets:view">
      <AccountsList />
    </AdminGate>
  );
}
