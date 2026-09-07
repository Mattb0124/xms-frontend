"use client";

import { useCallback } from "react";
import { useToast } from "@/components/xms/toast";
import { apiError, describeError, type ApiError } from "@/lib/admin/api-error";

/**
 * One place for the mutation error policy: a 409 stale_version toasts and
 * reloads the record (the concurrent-edit rule from the technical spec);
 * anything else toasts its typed message. Returns the parsed error so a
 * screen can also render it inline (last_administrator, validation).
 */
export function useMutationErrors(refetch?: () => unknown): (error: unknown) => ApiError {
  const { push } = useToast();
  return useCallback(
    (error: unknown) => {
      const parsed = apiError(error);
      if (parsed.code === "stale_version") {
        push({ title: "Reloaded", detail: describeError(parsed), tone: "error" });
        refetch?.();
      } else {
        push({ title: "Not saved", detail: describeError(parsed), tone: "error" });
      }
      return parsed;
    },
    [push, refetch],
  );
}
