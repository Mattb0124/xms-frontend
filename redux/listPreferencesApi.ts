import { xmsApi } from "@/redux/api";

/**
 * One reader's arrangement of one list: which columns it draws, in what
 * order, and the display switches beside them.
 *
 * The store is keyed on the person, so an arrangement follows them between
 * accounts and machines rather than living in this browser.
 */
export interface ListPreference {
  screen: string;
  columns: string[];
  options: Record<string, unknown>;
  updated_at: string;
}

export const listPreferencesApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    getListPreferences: build.query<ListPreference[], void>({
      query: () => "/v1/me/list-preferences",
      providesTags: ["ListPreferences"],
    }),
    saveListPreference: build.mutation<
      ListPreference,
      { screen: string; columns: string[]; options: Record<string, unknown> }
    >({
      query: ({ screen, columns, options }) => ({
        url: `/v1/me/list-preferences/${screen}`,
        method: "PUT",
        body: { columns, options },
      }),
      invalidatesTags: ["ListPreferences"],
    }),
    clearListPreference: build.mutation<void, string>({
      query: (screen) => ({ url: `/v1/me/list-preferences/${screen}`, method: "DELETE" }),
      invalidatesTags: ["ListPreferences"],
    }),
  }),
});

export const { useGetListPreferencesQuery, useSaveListPreferenceMutation, useClearListPreferenceMutation } =
  listPreferencesApi;
