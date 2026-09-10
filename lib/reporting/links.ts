/**
 * How long a delivered report link lives.
 *
 * The API signs every rendition link for the SigV4 maximum, seven days, and
 * refuses to mint a longer one: AWS rejects an `X-Amz-Expires` over 604800
 * seconds at redemption, so a fourteen-day link would simply fail on the
 * eighth day with nothing to explain it. The spec asks for fourteen; this is
 * the deviation, and it is stated in the copy rather than hidden, so a
 * consultant forwarding a pack knows what they are forwarding.
 */
export const DELIVERY_LINK_DAYS = 7;

export const DELIVERY_LINK_NOTE = `Every link here is signed for ${DELIVERY_LINK_DAYS} days. After that it stops opening and the pack has to be sent again.`;
