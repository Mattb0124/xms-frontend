import { xmsApi } from "@/redux/api";

/**
 * Attachments (Ticket Management technical 2.4 and 3.3, Security section 6).
 * The API mints the upload and download URLs after an RLS-protected read;
 * the browser only carries bytes. The portal mirror sees public, clean
 * files only.
 */
export type ScanState = "pending" | "clean" | "quarantined";
export type AttachmentOrigin = "internal" | "portal" | "email" | "sync";
export type AttachmentVisibility = "public" | "internal";

export interface Attachment {
  id: string;
  ticket_id: string;
  comment_id: string | null;
  work_note_id: string | null;
  file_name: string;
  content_type: string;
  size_bytes: string;
  scan_state: ScanState;
  scan_detail: Record<string, unknown> | null;
  origin: AttachmentOrigin;
  visibility: AttachmentVisibility;
  uploaded_by: string;
  uploaded_by_name: string;
  created_at: string;
}

export interface PresignBody {
  file_name: string;
  content_type: string;
  size_bytes: number;
}

export interface PresignedUpload {
  url: string;
  method: "POST" | "PUT";
  fields: Record<string, string>;
  expiresAt: string;
}

export interface PresignResponse {
  attachment: Attachment;
  upload: PresignedUpload;
}

export interface DownloadResponse {
  url: string;
  file_name: string;
  content_type: string;
}

const base = (portal?: boolean) => (portal ? "/v1/portal" : "/v1");
const attachmentsTag = (key: string) => ({ type: "Attachments" as const, id: key });

export const attachmentsApi = xmsApi.injectEndpoints({
  endpoints: (build) => ({
    listAttachments: build.query<Attachment[], { key: string; portal?: boolean }>({
      query: ({ key, portal }) => `${base(portal)}/tickets/${key}/attachments`,
      providesTags: (_result, _error, { key }) => [attachmentsTag(key)],
    }),
    presignAttachment: build.mutation<PresignResponse, { key: string; body: PresignBody; portal?: boolean }>({
      query: ({ key, body, portal }) => ({
        url: `${base(portal)}/tickets/${key}/attachments/presign`,
        method: "POST",
        body,
      }),
    }),
    confirmAttachment: build.mutation<
      Attachment,
      { key: string; id: string; visibility?: AttachmentVisibility; portal?: boolean }
    >({
      query: ({ key, id, visibility, portal }) => ({
        url: `${base(portal)}/tickets/${key}/attachments/${id}/confirm`,
        method: "POST",
        body: visibility ? { visibility } : {},
      }),
      invalidatesTags: (_result, _error, { key }) => [attachmentsTag(key)],
    }),
    downloadAttachment: build.query<DownloadResponse, { id: string; portal?: boolean }>({
      query: ({ id, portal }) => `${base(portal)}/attachments/${id}/download`,
      keepUnusedDataFor: 0,
    }),
    deleteAttachment: build.mutation<void, { id: string; key: string }>({
      query: ({ id }) => ({ url: `/v1/attachments/${id}`, method: "DELETE" }),
      invalidatesTags: (_result, _error, { key }) => [attachmentsTag(key)],
    }),
  }),
});

export const {
  useListAttachmentsQuery,
  usePresignAttachmentMutation,
  useConfirmAttachmentMutation,
  useLazyDownloadAttachmentQuery,
  useDeleteAttachmentMutation,
} = attachmentsApi;
