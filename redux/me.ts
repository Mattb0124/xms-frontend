"use client";

import { useMemo } from "react";
import { useMeQuery, type Principal } from "@/redux/api";

export interface Me {
  /** Undefined until the API has answered; screens fail closed on undefined. */
  principal: Principal | undefined;
  permissions: ReadonlySet<string> | undefined;
  grantedAccounts: string[];
  isLoading: boolean;
  isError: boolean;
  hasPermission: (key: string) => boolean;
}

/**
 * Reads /v1/admin/me once (RTK cache) and exposes display-gating helpers.
 * The API is the authority: a screen hidden here is still guarded there.
 */
export function useMe(): Me {
  const { data, isLoading, isError } = useMeQuery();
  return useMemo(() => {
    const principal = data?.principal;
    const permissions = principal ? new Set(principal.permissions) : undefined;
    return {
      principal,
      permissions,
      grantedAccounts: principal?.accountIds ?? [],
      isLoading,
      isError,
      hasPermission: (key: string) => permissions?.has(key) ?? false,
    };
  }, [data, isLoading, isError]);
}
