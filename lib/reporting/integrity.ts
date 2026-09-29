/**
 * The words the integrity panel uses (Audit & Analytics 7.1 and section 6,
 * backend cecce62). Nothing here computes a figure: every number arrives from
 * the API and this file only says what it means, which matters more here than
 * anywhere else on the desk, because "the last verification matched" and
 * "nothing has ever been verified" look alike as data and are opposites as
 * facts.
 */
import type { ArchiveStream, ChainStream, HotRetention, StreamSpan } from "@/redux/reportingApi";

/** A day, an instant or nothing at all, in the one wording the panel uses for a missing moment. */
export function momentLabel(value: string | null | undefined, absent = "Never"): string {
  if (!value) return absent;
  return value.length <= 10 ? value : value.slice(0, 19).replace("T", " ");
}

/** The first twelve characters of a SHA-256, which is what a person compares by eye. */
export function digestLabel(digest: string | null | undefined): string {
  return digest ? `${digest.slice(0, 12)}...` : "";
}

export type VerdictTone = "good" | "warn" | "breach";

/**
 * What the last verification of one stream says. A stream that has never been
 * verified is not a passing one: it reads as unverified and is toned as a
 * warning, because an unchecked chain proves nothing.
 */
export function verificationLine(stream: ChainStream): { text: string; tone: VerdictTone } {
  if (stream.last_verification_matched === null || stream.last_verified_at === null)
    return { text: "Never verified", tone: "warn" };
  return stream.last_verification_matched
    ? { text: `Matched, ${momentLabel(stream.last_verified_at)}`, tone: "good" }
    : { text: `Did not match, ${momentLabel(stream.last_verified_at)}`, tone: "breach" };
}

/** The line over the chain: when it last ran, when it was last checked, and whether anything ever failed. */
export function chainSummary(chain: {
  last_digest_at: string | null;
  last_verification_at: string | null;
  last_mismatch_at: string | null;
}): { text: string; tone: VerdictTone } {
  if (chain.last_mismatch_at)
    return { text: `A digest did not match on ${momentLabel(chain.last_mismatch_at)}`, tone: "breach" };
  if (!chain.last_digest_at) return { text: "No day has been digested yet", tone: "warn" };
  if (!chain.last_verification_at)
    return { text: `Last digest ${momentLabel(chain.last_digest_at)}, never verified`, tone: "warn" };
  return {
    text: `Last digest ${momentLabel(chain.last_digest_at)}, last verified ${momentLabel(chain.last_verification_at)}, no mismatch recorded`,
    tone: "good",
  };
}

/** Bytes in cold storage, in the unit a person reads. */
export function bytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function archiveLine(row: ArchiveStream): string {
  return `${row.days} day${row.days === 1 ? "" : "s"}, ${row.rows} rows, ${bytesLabel(row.bytes)}`;
}

/** How far back this reader's own events go, and how many there are. */
export function spanLine(span: StreamSpan): string {
  if (span.n === 0 || !span.oldest || !span.newest) return "No events";
  return `${momentLabel(span.oldest)} to ${momentLabel(span.newest)}`;
}

/**
 * The retention policy said as the policy it is. `detach_job_built` is false
 * today and the last line says so in plain words: the months are what the
 * platform promises, not what any job has done, and a screen that printed
 * them without that would be reporting a promise as a measurement.
 */
export function retentionLines(retention: HotRetention): string[] {
  return [
    `Security events: ${retention.security_months} months in the database.`,
    `Usage events: ${retention.usage_months} months in the database.`,
    `Audit events: ${retention.audit}.`,
    retention.detach_job_built
      ? "The job that moves older partitions out is running."
      : "This is the declared policy, not a measurement: the job that detaches older partitions is not built yet, so nothing has been moved out.",
    `Source: ${retention.source}.`,
  ];
}
