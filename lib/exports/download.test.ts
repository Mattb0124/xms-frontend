import { afterEach, describe, expect, it, vi } from "vitest";
import { DownloadError, fetchDownload, fileNameFromDisposition, saveBlob } from "@/lib/exports/download";

vi.mock("@/lib/auth/token", () => ({ getBearerToken: async () => "tok-1" }));

describe("fileNameFromDisposition", () => {
  it("reads quoted, bare and RFC 5987 names, and falls back", () => {
    expect(fileNameFromDisposition('attachment; filename="tickets-2026-09-07.xlsx"', "x")).toBe(
      "tickets-2026-09-07.xlsx",
    );
    expect(fileNameFromDisposition("attachment; filename=events.csv", "x")).toBe("events.csv");
    expect(fileNameFromDisposition("attachment; filename*=UTF-8''r%C3%A9sum%C3%A9.csv", "x")).toBe("résumé.csv");
    expect(fileNameFromDisposition(null, "fallback.csv")).toBe("fallback.csv");
  });
});

describe("fetchDownload", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the bearer, posts JSON bodies, and returns the blob with the name and row count", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response("a,b\n1,2\n", {
        status: 200,
        headers: { "content-disposition": 'attachment; filename="events.csv"', "x-row-count": "1" },
      });
    });
    const file = await fetchDownload(
      { url: "/v1/audit/export", method: "POST", body: { conditions: [] }, fallbackName: "x.csv" },
      fetchImpl as unknown as typeof fetch,
    );
    expect(file.fileName).toBe("events.csv");
    expect(file.rowCount).toBe(1);
    expect(file.blob.size).toBe(8);
    expect(calls[0].url).toBe("http://localhost:3001/v1/audit/export");
    expect(calls[0].init.method).toBe("POST");
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe("Bearer tok-1");
    expect(calls[0].init.body).toBe('{"conditions":[]}');
  });

  it("throws a typed error carrying the API code on failure", async () => {
    const fetchImpl = vi.fn(async () => new Response('{"code":"invalid_conditions"}', { status: 400 }));
    const attempt = fetchDownload(
      { url: "/v1/exports/tickets", fallbackName: "t.xlsx" },
      fetchImpl as unknown as typeof fetch,
    );
    await expect(attempt).rejects.toBeInstanceOf(DownloadError);
    await attempt.catch((error: DownloadError) => {
      expect(error.status).toBe(400);
      expect(error.code).toBe("invalid_conditions");
    });
  });
});

describe("saveBlob", () => {
  it("clicks a temporary anchor with the object URL and the file name, then removes it", () => {
    const createObjectURL = vi.fn(() => "blob:xms/1");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    let seen: { href: string; download: string } | null = null;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      seen = { href: this.href, download: this.download };
    });
    saveBlob(new Blob(["x"]), "tickets.csv");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(seen).toEqual({ href: "blob:xms/1", download: "tickets.csv" });
    expect(document.querySelector("a[download]")).toBeNull();
    click.mockRestore();
  });
});

/**
 * The Content-Disposition filename is server-supplied and goes straight into
 * `a.download`. Browsers sanitise it themselves; this is the layer that does
 * not depend on that (security review finding 38).
 */
describe("the download filename", () => {
  const bell = String.fromCharCode(7);

  it("strips path separators, control characters and bidi overrides from the header name", () => {
    expect(fileNameFromDisposition('attachment; filename="../../etc/passwd"', "export.csv")).toBe("etc_passwd");
    expect(fileNameFromDisposition(`attachment; filename="rep${bell}ort.csv"`, "export.csv")).toBe("report.csv");
    // %E2%80%AE is the right-to-left override, which makes "fdp.exe" read as "exe.pdf".
    expect(fileNameFromDisposition("attachment; filename*=UTF-8''annual%E2%80%AEfdp.exe", "export.csv")).toBe(
      "annualfdp.exe",
    );
  });

  it("falls back when nothing usable is left", () => {
    expect(fileNameFromDisposition('attachment; filename="///"', "export.csv")).toBe("export.csv");
    expect(fileNameFromDisposition(null, "export.csv")).toBe("export.csv");
  });

  it("sanitises again in saveBlob and marks the anchor noopener noreferrer", () => {
    const createObjectURL = vi.fn(() => "blob:xms/2");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    let seen: { download: string; rel: string } | null = null;
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      seen = { download: this.download, rel: this.rel };
    });
    saveBlob(new Blob(["x"]), "../../etc/passwd");
    expect(seen).toEqual({ download: "etc_passwd", rel: "noopener noreferrer" });
    click.mockRestore();
  });
});
