"use client";

import { useCallback } from "react";
import { useToast } from "@/components/xms/toast";
import { useTrack } from "@/lib/telemetry/provider";
import { describeTransitionError, transitionError, type TransitionError } from "@/lib/tickets/transition-errors";
import { useTransitionTicketMutation, type TicketView, type TransitionBody } from "@/redux/ticketsApi";

/**
 * The one way a screen changes state: optimistic through the mutation,
 * a typed toast on failure, and the record re-read whenever the server says
 * it moved elsewhere. Returns the new view or undefined when refused.
 *
 * `onRefused` is for a refusal the screen can act on rather than only read:
 * it returns true when it has taken the refusal over, and the toast is left
 * unsent so the reader is not told the same thing twice. The change-window
 * sheet is the one caller (TM-18), because each of those refusals can be
 * carried with a reason.
 */
export function useTransition(
  key: string,
  onRefused?: (error: TransitionError) => boolean,
): {
  transition: (body: TransitionBody, label?: string) => Promise<TicketView | undefined>;
  pending: boolean;
} {
  const [mutate, { isLoading }] = useTransitionTicketMutation();
  const { push } = useToast();
  const track = useTrack("ticket.transition");
  const transition = useCallback(
    async (body: TransitionBody, label?: string) => {
      try {
        const view = await mutate({ key, body, label }).unwrap();
        track({ to: body.to, reopen: false });
        return view;
      } catch (error) {
        const parsed = transitionError(error);
        if (onRefused?.(parsed)) return undefined;
        const copy = describeTransitionError(parsed);
        push({ title: copy.title, detail: copy.detail, tone: copy.tone });
        // The mutation's invalidation already refetches the record and its
        // transitions on `reload`; nothing else to do here.
        return undefined;
      }
    },
    [key, mutate, onRefused, push, track],
  );
  return { transition, pending: isLoading };
}
