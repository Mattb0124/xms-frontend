"use client";

import Link from "next/link";
import { useMemo } from "react";
import { EmptyBanner } from "@/components/xms/empty-banner";
import { KeyLink, TextLink } from "@/components/xms/key-link";
import { RecordForm, type RecordField } from "@/components/xms/record-form";
import { Skeleton } from "@/components/xms/skeleton";
import { useToast } from "@/components/xms/toast";
import { useMe } from "@/redux/me";
import { useGetContactQuery, useUpdateContactMutation } from "@/redux/contactsApi";
import { useListGrantedAccountsQuery, useListTicketsQuery } from "@/redux/ticketsApi";

/**
 * One contact: who they are, how to reach them, which account they belong to
 * and what they have raised.
 *
 * The Cases list names a contact on every row and had nowhere to send a
 * reader who clicked one. A consultant about to ring someone needs the
 * number, the role and the hours in front of them, not an account page with
 * a contacts tab on it.
 *
 * The details commit on blur like every other record in the product, and only
 * for a reader who administers the account; anyone who may see a case may
 * read the person behind it.
 */
export function ContactRecord({ contactId }: { contactId: string }) {
  const me = useMe();
  const { push } = useToast();
  const { data: contact, isLoading, isError } = useGetContactQuery(contactId);
  const { data: accounts } = useListGrantedAccountsQuery();
  const [update] = useUpdateContactMutation();
  const canEdit = me.hasPermission("admin:accounts");

  // What this person has raised, newest first: the reason a desk opens a
  // contact at all is usually the case they are ringing about.
  const { data: cases } = useListTicketsQuery({ requester_contact_id: contactId, limit: 25 }, { skip: !contact });

  const account = accounts?.find((entry) => entry.id === contact?.account_id);

  const fields = useMemo<RecordField[]>(() => {
    if (!contact) return [];
    return [
      { key: "display_name", label: "Name", value: contact.display_name, readOnly: !canEdit },
      { key: "email", label: "Email", value: contact.email, readOnly: true },
      {
        key: "phone",
        label: "Phone",
        value: contact.phone ?? "",
        readOnly: !canEdit,
        hint: !canEdit && !contact.phone ? "Ask an account administrator to add one." : undefined,
      },
      { key: "job_title", label: "Job title", value: contact.job_title ?? "", readOnly: !canEdit },
      {
        key: "time_zone",
        label: "Time zone",
        value: contact.time_zone ?? "",
        readOnly: !canEdit,
        hint: contact.time_zone ? undefined : "Where they sit, so a call lands in their working day.",
      },
      { key: "notes", label: "Notes", value: contact.notes ?? "", kind: "textarea", readOnly: !canEdit },
    ];
  }, [contact, canEdit]);

  if (isLoading) return <Skeleton lines={8} />;
  if (isError || !contact)
    return (
      <EmptyBanner
        title="That contact is not here"
        detail="It may belong to an account you do not hold, or it may have been removed."
        action={{ label: "Back to Cases", href: "/cases" }}
      />
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xms-ink text-[20px] leading-[1.25] font-semibold">
          {contact.display_name || contact.email}
        </h1>
        {contact.status === "blocked" ? (
          <span className="xms-state-mark" data-state="closed">
            <span className="xms-state-label">Blocked</span>
          </span>
        ) : null}
        {contact.portal_user_id ? (
          <span className="text-xms-label text-[13px]">Signs in to the portal</span>
        ) : (
          <span className="text-xms-muted text-[13px]">No portal sign-in</span>
        )}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="xms-card flex flex-col" aria-label="Contact details">
          <header className="border-xms-line flex min-h-[48px] items-center border-b px-5 py-3">
            <span className="text-xms-ink text-[17px] leading-[1.3] font-semibold">Details</span>
          </header>
          <div className="px-5 py-2">
            <RecordForm
              fields={fields}
              layout="stacked"
              onCommit={async (key, value) => {
                await update({ id: contact.id, body: { version: contact.version, [key]: value } }).unwrap();
              }}
              onRollback={(_key, _restored, error) =>
                push({ title: `That change did not save: ${String(error ?? "")}`, tone: "error" })
              }
            />
          </div>
        </section>

        <div className="flex flex-col gap-[14px]">
          <section className="xms-card p-4" aria-label="Account">
            <p className="xms-eyebrow">Account</p>
            <p className="mt-2 text-[15px]">
              {account ? (
                <TextLink href={`/accounts/${contact.account_id}`}>{account.name}</TextLink>
              ) : (
                <span className="text-xms-body">Not on an account you hold</span>
              )}
            </p>
            {account?.owner_name ? (
              <p className="text-xms-label mt-2 text-[13px]">
                CSM{" "}
                {account.owner_id ? (
                  <TextLink href={`/roster/${account.owner_id}`}>{account.owner_name}</TextLink>
                ) : (
                  account.owner_name
                )}
              </p>
            ) : null}
          </section>

          <section className="xms-card p-4" aria-label="Cases raised">
            <p className="xms-eyebrow">Cases raised</p>
            {cases?.items?.length ? (
              <ul className="mt-2 flex flex-col gap-2">
                {cases.items.slice(0, 8).map((row) => (
                  <li key={row.key} className="flex items-baseline gap-2 text-[13px]">
                    <KeyLink ticketKey={row.key} />
                    <span className="text-xms-body min-w-0 flex-1 truncate">{row.short_description}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xms-label mt-2 text-[13px]">Nothing raised yet.</p>
            )}
            {cases?.items?.length ? (
              <p className="mt-3 text-[13px]">
                <Link href={`/cases?q=${encodeURIComponent(contact.email)}`} className="xms-link">
                  Every case from this contact
                </Link>
              </p>
            ) : null}
          </section>
        </div>
      </div>
    </div>
  );
}
