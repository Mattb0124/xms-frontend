import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { getBearerToken } from "@/lib/auth/token";
import { rememberRequestId } from "@/lib/telemetry/request-id";

/** Build-time base URL for the XMS API (never a secret; see .env.example). */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001";

export interface Principal {
  kind: "internal" | "portal" | "api_client" | "harness";
  userId: string;
  accountIds: string[];
  permissions: string[];
  displayName?: string;
  email?: string;
}

export interface MeResponse {
  principal: Principal;
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: "omit",
  prepareHeaders: async (headers) => {
    const token = await getBearerToken();
    if (token) headers.set("authorization", `Bearer ${token}`);
    headers.set("accept", "application/json");
    return headers;
  },
});

/**
 * The XMS base API. Feature slices inject their endpoints; every request
 * carries the bearer from the token provider and every response's request id
 * is remembered so the telemetry client can correlate the next click.
 */
export const xmsApi = createApi({
  reducerPath: "xmsApi",
  baseQuery: async (args, api, extra) => {
    const result = await rawBaseQuery(args, api, extra);
    const requestId = result.meta?.response?.headers.get("x-request-id");
    if (requestId) rememberRequestId(requestId);
    return result;
  },
  tagTypes: [
    "Me",
    "Accounts",
    "Account",
    "Users",
    "User",
    "Roles",
    "Role",
    "Groups",
    "Group",
    "Config",
    "Tickets",
    "Ticket",
    "Notifications",
    "PortalMe",
    "PortalTickets",
    "PortalTicket",
    "PortalTimeline",
    "Articles",
    "Article",
    "Solutions",
    "Catalogs",
    "Time",
    "Position",
    "Attachments",
    "Email",
    "Quarantine",
    "Aliases",
    "Dashboards",
    "Reports",
    "Suggestions",
    "AiThreads",
    "AiSettings",
    "AiAccuracy",
    "AiDefaults",
    "Connectors",
    "ConnectorMaps",
    "ConnectorRuns",
    "ConnectorDeadLetters",
    "TicketSync",
  ],
  endpoints: (build) => ({
    me: build.query<MeResponse, void>({
      query: () => "/v1/admin/me",
      providesTags: ["Me"],
    }),
  }),
});

export const { useMeQuery } = xmsApi;
