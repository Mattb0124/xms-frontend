import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UploadRefusal,
  describeRefusal,
  formatBytes,
  uploadAttachment,
  type UploadProgress,
} from "@/lib/attachments/upload";
import { scanChip } from "@/lib/attachments/scan";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

interface Call {
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
}

function fetchStub(routes: (call: Call) => Response): { calls: Call[]; impl: typeof fetch } {
  const calls: Call[] = [];
  const impl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const call: Call = {
      url: String(input),
      method: (init?.method ?? "GET").toUpperCase(),
      body: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
      headers: init?.headers as Record<string, string>,
    };
    calls.push(call);
    return routes(call);
  }) as unknown as typeof fetch;
  return { calls, impl };
}

const attachment = (scan: "pending" | "clean" | "quarantined") => ({
  id: "att-1",
  ticket_id: "t-1",
  comment_id: null,
  work_note_id: null,
  file_name: "notes.txt",
  content_type: "text/plain",
  size_bytes: "5",
  scan_state: scan,
  scan_detail: null,
  origin: "internal",
  visibility: "internal",
  uploaded_by: "u",
  uploaded_by_name: "Cara",
  created_at: "2026-09-07T09:00:00Z",
});

describe("uploadAttachment", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("presigns, PUTs the raw body to the local store, confirms with the visibility, and reports the stages", async () => {
    const { calls, impl } = fetchStub((call) => {
      if (call.url.endsWith("/presign")) {
        return jsonResponse({
          attachment: attachment("pending"),
          upload: {
            url: "http://api.test/v1/storage/upload?key=k&signature=s",
            method: "PUT",
            fields: {},
            expiresAt: "x",
          },
        });
      }
      if (call.url.includes("/storage/upload")) return jsonResponse({ ok: true, size: 5 });
      if (call.url.endsWith("/confirm")) return jsonResponse(attachment("clean"));
      return jsonResponse({ code: "not_found" }, 404);
    });
    const stages: UploadProgress[] = [];
    const file = new File(["hello"], "notes.txt", { type: "text/plain" });
    const result = await uploadAttachment("CS0001001", file, {
      fetchImpl: impl,
      visibility: "public",
      onProgress: (progress) => stages.push(progress),
    });
    expect(result.scan_state).toBe("clean");
    expect(calls[0]).toMatchObject({
      method: "POST",
      url: "http://localhost:3001/v1/tickets/CS0001001/attachments/presign",
      body: { file_name: "notes.txt", content_type: "text/plain", size_bytes: 5 },
    });
    expect(calls[1]).toMatchObject({ method: "PUT", url: "http://api.test/v1/storage/upload?key=k&signature=s" });
    expect(calls[1].headers).toMatchObject({ "content-type": "text/plain" });
    expect(calls[1].body).toBe(file);
    expect(calls[2]).toMatchObject({
      method: "POST",
      url: "http://localhost:3001/v1/tickets/CS0001001/attachments/att-1/confirm",
      body: { visibility: "public" },
    });
    expect(stages.map((stage) => stage.stage)).toEqual(["presigning", "uploading", "uploading", "scanning", "clean"]);
  });

  it("POSTs a form with the presigned fields for S3 on the portal path and surfaces a quarantine verdict", async () => {
    const { calls, impl } = fetchStub((call) => {
      if (call.url.endsWith("/presign")) {
        return jsonResponse({
          attachment: attachment("pending"),
          upload: { url: "https://bucket.s3.test/", method: "POST", fields: { key: "k", policy: "p" }, expiresAt: "x" },
        });
      }
      if (call.url === "https://bucket.s3.test/") return new Response(null, { status: 204 });
      if (call.url.endsWith("/confirm")) return jsonResponse(attachment("quarantined"));
      return jsonResponse({ code: "not_found" }, 404);
    });
    const result = await uploadAttachment("CS0001001", new File(["x"], "eicar.txt", { type: "text/plain" }), {
      fetchImpl: impl,
      portal: true,
    });
    expect(result.scan_state).toBe("quarantined");
    expect(calls[0].url).toBe("http://localhost:3001/v1/portal/tickets/CS0001001/attachments/presign");
    const form = calls[1].body as FormData;
    expect(form.get("key")).toBe("k");
    expect(form.get("policy")).toBe("p");
    expect((form.get("file") as File).name).toBe("eicar.txt");
    // The portal never sends a visibility.
    expect(calls[2].body).toEqual({});
  });

  it("turns a too_large refusal into a typed error with the limit and never uploads", async () => {
    const { calls, impl } = fetchStub(() => jsonResponse({ code: "too_large", max_bytes: 26214400 }, 400));
    await expect(
      uploadAttachment("CS0001001", new File(["x"], "big.pdf", { type: "application/pdf" }), { fetchImpl: impl }),
    ).rejects.toMatchObject({ code: "too_large" });
    expect(calls).toHaveLength(1);
    expect(describeRefusal(new UploadRefusal("too_large", { max_bytes: 26214400 }))).toBe(
      "The file is larger than the 25.0 MB limit.",
    );
    expect(describeRefusal(new UploadRefusal("unsupported_type"))).toBe("That file type is not accepted.");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(4096)).toBe("4 KB");
  });
});

describe("scanChip", () => {
  it("maps scan states and stages to the ramp, in desk and client language", () => {
    expect(scanChip("pending")).toEqual({ label: "Scanning", ramp: "new", danger: false });
    expect(scanChip("clean")).toEqual({ label: "Clean", ramp: "resolved", danger: false });
    expect(scanChip("quarantined")).toEqual({ label: "Quarantined", ramp: "closed", danger: true });
    expect(scanChip("uploading").label).toBe("Uploading");
    expect(scanChip("pending", true).label).toBe("Checking file");
    expect(scanChip("clean", true).label).toBe("Ready");
    expect(scanChip("quarantined", true).label).toBe("Blocked by security scan");
  });
});
