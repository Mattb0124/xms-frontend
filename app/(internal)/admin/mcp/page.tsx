"use client";

import { AdminGate } from "@/components/admin/primitives";
import { McpLibraryPanel } from "@/components/admin/mcp/library-panel";

/**
 * Registered as `admin.mcp`: the operator's library of MCP connections
 * (AI Integration section 4, ADR-19).
 *
 * The catalog is here and the choice is on the account: a client gets the
 * connections the operator turned on for it, so Axel working a Brookfield
 * ticket reaches Brookfield's systems and nobody else's. The per-account half
 * is the MCP connections panel on the account record.
 *
 * The body is a child so nothing is asked before the gate decides
 * (`components/admin/fail-closed.test.ts`): the library route answers
 * `admin:config` alone, and a reader without it would otherwise take a 403,
 * and write a security event, before this screen drew its own refusal.
 */
export default function AdminMcpPage() {
  return (
    <AdminGate permission="admin:config">
      <McpLibraryPanel />
    </AdminGate>
  );
}
