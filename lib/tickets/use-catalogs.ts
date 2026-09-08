"use client";

import { useMemo } from "react";
import { RESOLUTION_CODES, type ResolutionCode } from "@/lib/tickets/vocab";
import { useCatalogsQuery, type Catalogs } from "@/redux/knowledgeApi";

export interface ActivityType {
  key: string;
  label: string;
  billableClass: string;
}

export interface BillableClass {
  key: string;
  label: string;
  consumesContract: boolean;
}

export interface DeskCatalogs {
  resolutionCodes: ResolutionCode[];
  activityTypes: ActivityType[];
  billableClasses: BillableClass[];
  loaded: boolean;
}

const FALLBACK_ACTIVITIES: ActivityType[] = [
  { key: "analysis", label: "Analysis and investigation", billableClass: "billable" },
  { key: "development", label: "Development and configuration", billableClass: "billable" },
  { key: "testing", label: "Testing and validation", billableClass: "billable" },
  { key: "client_meeting", label: "Client meeting", billableClass: "billable" },
  { key: "documentation", label: "Documentation", billableClass: "billable" },
  { key: "internal_review", label: "Internal review", billableClass: "non_billable" },
];

const FALLBACK_CLASSES: BillableClass[] = [
  { key: "billable", label: "Billable", consumesContract: true },
  { key: "non_billable", label: "Non-billable", consumesContract: false },
  { key: "absorbed", label: "Absorbed by Hackett", consumesContract: false },
  { key: "fixed_fee", label: "Fixed fee", consumesContract: false },
];

export function toDeskCatalogs(data: Catalogs | undefined): DeskCatalogs {
  if (!data) {
    return {
      resolutionCodes: RESOLUTION_CODES,
      activityTypes: FALLBACK_ACTIVITIES,
      billableClasses: FALLBACK_CLASSES,
      loaded: false,
    };
  }
  return {
    resolutionCodes: data.resolution_codes.map((code) => ({
      key: code.key,
      label: code.label,
      noSolution: code.no_solution,
    })),
    activityTypes: data.activity_types.map((activity) => ({
      key: activity.key,
      label: activity.label,
      billableClass: activity.billable_class,
    })),
    billableClasses: data.billable_classes.map((entry) => ({
      key: entry.key,
      label: entry.label,
      consumesContract: entry.consumes_contract,
    })),
    loaded: true,
  };
}

/**
 * The desk catalogs resolved for one account; the seed vocabulary stands in
 * while loading. Pass `skip` while the account is still unknown: without it
 * a record asked for the bare catalogs on its first render and for the
 * account's on the next, two calls where one will do (review finding 24).
 */
export function useCatalogs(accountId?: string, options?: { skip?: boolean }): DeskCatalogs {
  const { data } = useCatalogsQuery(accountId, { skip: options?.skip });
  return useMemo(() => toDeskCatalogs(data), [data]);
}
