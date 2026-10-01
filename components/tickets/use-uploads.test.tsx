import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUploads } from "@/components/tickets/attachments";
import type { Attachment, AttachmentVisibility } from "@/redux/attachmentsApi";

const attachment = (overrides: Partial<Attachment> = {}): Attachment => ({
  id: "att-1",
  ticket_id: "t-1",
  comment_id: null,
  work_note_id: null,
  file_name: "notes.txt",
  content_type: "text/plain",
  size_bytes: "5",
  scan_state: "pending",
  scan_detail: null,
  origin: "internal",
  visibility: "public",
  uploaded_by: "u-1",
  uploaded_by_name: "Cara",
  created_at: "2026-09-07T09:00:00Z",
  ...overrides,
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** The upload routes, recording the body each confirm carried. */
function stubUploadRoutes(): unknown[] {
  const confirmed: unknown[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/presign")) {
        return jsonResponse({
          attachment: attachment(),
          upload: { url: "http://api.test/v1/storage/upload?key=k", method: "PUT", fields: {}, expiresAt: "x" },
        });
      }
      if (url.includes("/storage/upload")) return jsonResponse({ ok: true, size: 5 });
      if (url.endsWith("/confirm")) {
        confirmed.push(JSON.parse(String(init?.body)));
        return jsonResponse(attachment({ scan_state: "clean" }));
      }
      return jsonResponse({ code: "not_found" }, 404);
    }),
  );
  return confirmed;
}

describe("useUploads", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("confirms a file with the visibility the composer holds when the file is added", async () => {
    const confirmed = stubUploadRoutes();
    const { result, rerender } = renderHook(
      ({ visibility }: { visibility: AttachmentVisibility }) =>
        useUploads("CS0001001", { visibility: () => visibility }),
      { initialProps: { visibility: "public" } },
    );

    rerender({ visibility: "internal" });
    await act(() => result.current.add([new File(["hello"], "notes.txt", { type: "text/plain" })]));

    expect(confirmed).toEqual([{ visibility: "internal" }]);
    expect(result.current.items.map((item) => item.stage)).toEqual(["clean"]);
  });
});
