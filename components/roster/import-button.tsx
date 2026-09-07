"use client";

import { SECONDARY_BUTTON } from "@/components/admin/primitives";
import { useToast } from "@/components/xms/toast";
import { describeRosterError, rosterError } from "@/lib/roster/errors";
import { useTrack } from "@/lib/telemetry/provider";
import { useImportRosterMutation } from "@/redux/rosterApi";

/**
 * "Import from directory" (admin:users): creates a person for every active
 * internal user without one. Idempotent on the server, so the button is
 * safe to press twice; the toast carries the created count.
 */
export function ImportFromDirectoryButton() {
  const [importRoster, { isLoading }] = useImportRosterMutation();
  const { push } = useToast();
  const track = useTrack("roster.import");
  return (
    <button
      type="button"
      className={SECONDARY_BUTTON}
      disabled={isLoading}
      onClick={async () => {
        try {
          const result = await importRoster().unwrap();
          track({ created: result.created });
          push({
            title: result.created === 0 ? "Roster up to date" : `${result.created} ${result.created === 1 ? "person" : "people"} created`,
            detail:
              result.created === 0
                ? "Every active internal user is already on the roster."
                : "Each new person starts with FTE 100% and a Monday to Friday calendar.",
            tone: result.created === 0 ? "info" : "success",
          });
        } catch (caught) {
          push({ title: "Import failed", detail: describeRosterError(rosterError(caught)), tone: "error" });
        }
      }}
    >
      {isLoading ? "Importing" : "Import from directory"}
    </button>
  );
}
