import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";
import { CONTACT_FLAGS, type Contact, type ContactFlag, type SetContactFlagsBody } from "@/redux/adminApi";

/**
 * The contact flag vocabulary (Client Portal technical 2.1, functional
 * 5.7): what each flag means in the words an administrator needs to choose
 * it, the whole-set body the API takes, and the refusals.
 *
 * The set is closed at the API and again in the column's check constraint,
 * so a flag this build has never heard of is still shown rather than
 * silently dropped: the flags are a person's standing with the account, and
 * losing one quietly is how someone stops receiving the quarterly survey
 * without anyone noticing.
 */
export const FLAG_LABELS: Record<string, string> = {
  executive_sponsor: "Executive sponsor",
  billing_contact: "Billing contact",
  csat_recipient: "CSAT recipient",
};

export const FLAG_MEANINGS: Record<string, string> = {
  executive_sponsor: "Receives the quarterly relationship survey.",
  billing_contact: "The person invoices and billing questions go to.",
  csat_recipient: "Receives satisfaction surveys for the account's tickets.",
};

export function flagLabel(flag: string): string {
  return FLAG_LABELS[flag] ?? flag;
}

export function flagMeaning(flag: string): string | undefined {
  return FLAG_MEANINGS[flag];
}

/** The vocabulary to offer: the closed set, plus any flag a row already carries. */
export function flagsToOffer(contacts: readonly Pick<Contact, "flags">[]): string[] {
  const extra = new Set<string>();
  for (const contact of contacts)
    for (const flag of contact.flags) if (!CONTACT_FLAGS.includes(flag as ContactFlag)) extra.add(flag);
  return [...CONTACT_FLAGS, ...[...extra].sort()];
}

/** The set with `flag` added or removed, kept in the vocabulary's own order. */
export function toggleFlag(flags: readonly string[], flag: string, on: boolean): string[] {
  const next = new Set(flags);
  if (on) next.add(flag);
  else next.delete(flag);
  return flagsToOffer([{ flags: [...next] }]).filter((candidate) => next.has(candidate));
}

export function contactFlagsBody(version: number, flags: readonly string[]): SetContactFlagsBody {
  return { version, flags: flags as ContactFlag[] };
}

/** "Pat Client <pat@client.test>", or the address alone where there is no name. */
export function contactLabel(contact: Pick<Contact, "display_name" | "email">): string {
  return contact.display_name ? `${contact.display_name} <${contact.email}>` : contact.email;
}

/** What a contact's flags read as in one line, or the words when they carry none. */
export function flagsLine(flags: readonly string[]): string {
  return flags.length === 0 ? "No flags" : flags.map(flagLabel).join(", ");
}

export function contactsError(error: unknown): ApiError {
  return apiError(error);
}

export function describeContactsError(error: ApiError): string {
  switch (error.code) {
    case "stale_version":
      return "Someone else changed this contact. The list has been reloaded; try again.";
    case "not_found":
      return "That contact is no longer on this account. The list has been reloaded.";
    default:
      return describeError(error);
  }
}
