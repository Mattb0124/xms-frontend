"use client";

import { useMemo, useState } from "react";
import { INPUT, InlineError } from "@/components/admin/primitives";
import { Panel } from "@/components/xms/panel";
import { SignalPill } from "@/components/xms/signal-pill";
import { Skeleton } from "@/components/xms/skeleton";
import {
  contactFlagsBody,
  contactLabel,
  describeContactsError,
  flagLabel,
  flagMeaning,
  flagsLine,
  flagsToOffer,
  toggleFlag,
} from "@/lib/admin/contacts";
import { apiError } from "@/lib/admin/api-error";
import { useMutationErrors } from "@/lib/admin/use-mutation-errors";
import { cn } from "@/lib/utils";
import { useListContactsQuery, useSetContactFlagsMutation, type Contact } from "@/redux/adminApi";

/**
 * The account's contacts and their flags (Client Portal technical 2.1,
 * functional 5.7). A contact is a person the account writes to, portal user
 * or not; a flag says what they are for, and `executive_sponsor` is the one
 * the quarterly relationship survey addresses.
 *
 * The tab lives on the account record, which already gates on
 * admin:accounts, the permission the API guards both routes with; nothing
 * here is asked before that gate has decided. A flag is set one checkbox at
 * a time, but sent as the whole set with the version the row was read at,
 * which is what the API takes; a refusal is worded and the list read again.
 */
export function AccountContactsTab({ accountId }: { accountId: string }) {
  const [q, setQ] = useState("");
  const { data, isLoading, refetch } = useListContactsQuery({ accountId, q: q.trim() || undefined });
  const [setFlags, { isLoading: saving }] = useSetContactFlagsMutation();
  const onError = useMutationErrors(refetch);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const contacts = data ?? [];
  const flags = useMemo(() => flagsToOffer(contacts), [contacts]);

  const set = async (contact: Contact, flag: string, on: boolean) => {
    setError(null);
    setPending(`${contact.id}:${flag}`);
    try {
      await setFlags({
        accountId,
        id: contact.id,
        body: contactFlagsBody(contact.version, toggleFlag(contact.flags, flag, on)),
      }).unwrap();
    } catch (caught) {
      setError(describeContactsError(apiError(caught)));
      onError(caught);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="flex flex-col gap-4" data-testid="account-contacts">
      <Panel
        title="Contacts"
        caption="Who the account writes to"
        subtitle="A flag says what a contact is for. Executive sponsors receive the quarterly relationship survey."
        actions={
          <label className="text-xms-label flex items-center gap-2 text-[14px]">
            Search
            <input
              type="search"
              aria-label="Search contacts"
              className={cn(INPUT, "h-[28px] w-[200px] text-[14px]")}
              value={q}
              onChange={(event) => setQ(event.target.value)}
            />
          </label>
        }
      >
        <InlineError message={error} />
        {isLoading && !data ? <Skeleton lines={4} /> : null}
        {data && contacts.length === 0 ? (
          <p className="text-xms-label text-[14px]">
            {q.trim() ? "No contact matches that search." : "This account has no contacts yet."}
          </p>
        ) : null}
        {contacts.length > 0 ? (
          <ul className="divide-xms-line divide-y" aria-label="Contacts">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex flex-col gap-2 py-3" data-contact={contact.id}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xms-ink text-[14px]">{contactLabel(contact)}</span>
                  {contact.portal_user_id ? (
                    <SignalPill tone="complete" label="Portal user" />
                  ) : (
                    <span className="text-xms-label text-[14px]">No portal user</span>
                  )}
                  <span className="text-xms-label ml-auto text-[14px]" data-flags={contact.flags.join(",")}>
                    {flagsLine(contact.flags)}
                  </span>
                </div>
                <div
                  role="group"
                  aria-label={`Flags for ${contact.email}`}
                  className="flex flex-wrap items-center gap-4"
                >
                  {flags.map((flag) => (
                    <label key={flag} className="text-xms-body flex items-center gap-2 text-[14px]">
                      <input
                        type="checkbox"
                        checked={contact.flags.includes(flag)}
                        disabled={saving && pending !== null}
                        onChange={(event) => set(contact, flag, event.target.checked)}
                      />
                      <span title={flagMeaning(flag)}>{flagLabel(flag)}</span>
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>
    </div>
  );
}
