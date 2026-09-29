"use client";

import { useCallback } from "react";
import { useToast } from "@/components/xms/toast";
import { connectorError, describeConnectorError, type ConnectorError } from "@/lib/connectors/errors";

/**
 * The connector mutation error policy, mirroring lib/admin/use-mutation-errors
 * with the connector copy: stale_version toasts and reloads, everything
 * else toasts its typed message. Returns the parsed error for inline use.
 */
export function useConnectorErrors(refetch?: () => unknown): (error: unknown) => ConnectorError {
  const { push } = useToast();
  return useCallback(
    (error: unknown) => {
      const parsed = connectorError(error);
      if (parsed.code === "stale_version") {
        push({ title: "Reloaded", detail: describeConnectorError(parsed), tone: "error" });
        refetch?.();
      } else {
        push({ title: "Not saved", detail: describeConnectorError(parsed), tone: "error" });
      }
      return parsed;
    },
    [push, refetch],
  );
}
