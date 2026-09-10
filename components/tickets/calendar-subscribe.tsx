"use client";

import { useState } from "react";
import { PRIMARY_BUTTON, SECONDARY_BUTTON } from "@/components/admin/primitives";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError } from "@/lib/admin/api-error";
import { useCreateCalendarTokenMutation, useRevokeCalendarTokenMutation } from "@/redux/calendarFeedApi";

/**
 * Subscribe a calendar client to the change calendar (INT-05).
 *
 * The address carries a secret, so the server hands it over once and keeps
 * only its hash. There is no reading it back: a reader who loses it makes a
 * new one, and making one revokes whatever came before, which is also how a
 * reader takes an address off a device they no longer have.
 */
export function CalendarSubscribe() {
  const { push } = useToast();
  const [create, creating] = useCreateCalendarTokenMutation();
  const [revoke, revoking] = useRevokeCalendarTokenMutation();
  const [url, setUrl] = useState<string | null>(null);

  return (
    <section className="xms-card flex flex-col gap-3 p-4" aria-label="Subscribe to this calendar">
      <div>
        <p className="xms-eyebrow">In your own calendar</p>
        <p className="text-xms-body mt-2 text-[14px]">
          A subscription keeps the change windows and freezes in front of you without opening this screen. The address
          carries a secret, so it is shown once and never again.
        </p>
      </div>

      {url ? (
        <div className="flex flex-col gap-2">
          <label className="text-xms-label text-[14px]" htmlFor="calendar-feed-url">
            Paste this into your calendar client, then keep it somewhere safe.
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <input
              id="calendar-feed-url"
              readOnly
              value={url}
              onFocus={(event) => event.currentTarget.select()}
              className="border-xms-control-line bg-xms-card xms-mono h-[var(--xms-control-h)] min-w-0 flex-1 rounded-[var(--xms-radius-control)] border px-3 text-[14px]"
            />
            <button
              type="button"
              className={SECONDARY_BUTTON}
              onClick={() => {
                void navigator.clipboard?.writeText(url);
                push({ title: "Address copied", tone: "success" });
              }}
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={PRIMARY_BUTTON}
          disabled={creating.isLoading}
          onClick={async () => {
            try {
              const token = await create().unwrap();
              setUrl(token.url);
              push({ title: "Address made. Any earlier one has stopped working.", tone: "success" });
            } catch (error) {
              push({ title: describeError(apiError(error)), tone: "error" });
            }
          }}
        >
          {url ? "Make a new address" : "Subscribe"}
        </button>
        <button
          type="button"
          className={SECONDARY_BUTTON}
          disabled={revoking.isLoading}
          onClick={async () => {
            try {
              await revoke().unwrap();
              setUrl(null);
              push({ title: "Every address of yours has stopped working", tone: "success" });
            } catch (error) {
              push({ title: describeError(apiError(error)), tone: "error" });
            }
          }}
        >
          Stop every subscription
        </button>
      </div>
    </section>
  );
}
