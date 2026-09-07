"use client";

import { useCallback } from "react";
import { useToast } from "@/components/xms/toast";
import { useTrack } from "@/lib/telemetry/provider";
import { describeTransitionError, transitionError } from "@/lib/tickets/transition-errors";
import { useTransitionTicketMutation, type TicketView, type TransitionBody } from "@/redux/ticketsApi";

/**
 * The one way a screen changes state: optimistic through the mutation,
 * a typed toast on failure, and the record re-read whenever the server says
 * it moved elsewhere. Returns the new view or undefined when refused.
 */
export function useTransition(key: string): {
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
        const copy = describeTransitionError(transitionError(error));
        push({ title: copy.title, detail: copy.detail, tone: copy.tone });
        // The mutation's invalidation already refetches the record and its
        // transitions on `reload`; nothing else to do here.
        return undefined;
      }
    },
    [key, mutate, push, track],
  );
  return { transition, pending: isLoading };
}
