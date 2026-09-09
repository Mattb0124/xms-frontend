import { xmsApi } from "@/redux/api";

/**
 * A contact record: the person behind an address on a case.
 *
 * Reading one stands on `tickets:view`, because anyone who may see a case may
 * see who raised it; editing one stands on `admin:accounts`, because the
 * details belong to the account, not to the case.
 */
export interface Contact {
  id: string;
  account_id: string;
  email: string;
  display_name: string;
  phone: string | null;
  job_title: string | null;
  time_zone: string | null;
  notes: string | null;
  portal_user_id: string | null;
  status: string;
  flags: string[];
  created_at: string;
  updated_at: string;
  version: number;
}

export interface UpdateContactBody {
  version: number;
  display_name?: string;
  phone?: string;
  job_title?: string;
  time_zone?: string;
  notes?: string;
}

export const contactsApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    getContact: build.query<Contact, string>({
      query: (id) => `/v1/contacts/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Contact", id }],
    }),
    updateContact: build.mutation<Contact, { id: string; body: UpdateContactBody }>({
      query: ({ id, body }) => ({ url: `/v1/contacts/${id}`, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Contact", id }],
    }),
  }),
});

export const { useGetContactQuery, useUpdateContactMutation } = contactsApi;
