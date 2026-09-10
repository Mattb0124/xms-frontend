"use client";

import { AdminGate } from "@/components/admin/primitives";
import { TeamTime } from "@/components/time/team-time";

/**
 * Registered as `team_time`: entries across your group. The route registry
 * has always named this screen and nothing served it, so it stood in the
 * finder as a dead link.
 */
export default function TeamTimePage() {
  return (
    <AdminGate permission="time:adjust">
      <TeamTime />
    </AdminGate>
  );
}
