import { permanentRedirect } from "next/navigation";

/**
 * The list moved to /cases, and every address under it with it. A link
 * already sent, bookmarked or written into a notification still lands: the
 * old address redirects to the new one rather than answering as missing.
 *
 * It is a permanent redirect, because the move is not coming back.
 */
export default async function LegacyTicketRoute({ params }: { params: Promise<{ rest?: string[] }> }) {
  const { rest } = await params;
  const tail = (rest ?? []).map(encodeURIComponent).join("/");
  permanentRedirect(tail ? `/cases/${tail}` : "/cases");
}
