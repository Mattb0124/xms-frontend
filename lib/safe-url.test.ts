// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { join, sep } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { EXTERNAL_REL, isExternalHref, openExternal, safeFileName, safeHref } from "@/lib/safe-url";

function walk(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return walk(path);
    return /.tsx?$/.test(entry.name) && !/.test.tsx?$/.test(entry.name) ? [path] : [];
  });
}

const read = (file: string) => readFileSync(file, "utf8");
const relative = (file: string) =>
  file
    .slice(process.cwd().length + 1)
    .split(sep)
    .join("/");

/**
 * An href, a window.open target and a download name built from a string the
 * API returned are untrusted, whichever service first accepted them
 * (security review findings 26 and 38). With 'unsafe-inline' still in
 * script-src, the CSP would not stop a javascript: href either.
 */
describe("safeHref", () => {
  it("passes an ordinary web URL through", () => {
    expect(safeHref("https://brookfield.service-now.com/nav_to.do")).toBe(
      "https://brookfield.service-now.com/nav_to.do",
    );
    // The connector DTO allows plain http, so real instances must keep working.
    expect(safeHref("http://legacy.internal.test/record")).toBe("http://legacy.internal.test/record");
  });

  it("passes a path under the application", () => {
    expect(safeHref("/portal/requests/CS0001001")).toBe("/portal/requests/CS0001001");
    expect(safeHref("/v1/exports/tickets?format=csv")).toBe("/v1/exports/tickets?format=csv");
  });

  it("refuses a scheme that executes or embeds", () => {
    for (const candidate of [
      "javascript:alert(document.cookie)",
      "  javascript:alert(1)",
      "JavaScript:alert(1)",
      "java\nscript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "blob:https://portal.test/abc",
      "file:///etc/passwd",
    ]) {
      expect(safeHref(candidate), candidate).toBeNull();
    }
  });

  it("refuses a protocol-relative address, which leaves the application while looking like a path", () => {
    expect(safeHref("//evil.test/steal")).toBeNull();
    expect(safeHref("/\\evil.test/steal")).toBeNull();
  });

  it("refuses nothing at all", () => {
    expect(safeHref(null)).toBeNull();
    expect(safeHref(undefined)).toBeNull();
    expect(safeHref("")).toBeNull();
    expect(safeHref("   ")).toBeNull();
    expect(safeHref("not a url")).toBeNull();
  });

  it("names an external href", () => {
    expect(isExternalHref("https://x.test")).toBe(true);
    expect(isExternalHref("/cases")).toBe(false);
  });
});

describe("openExternal", () => {
  it("opens a validated URL with no opener and no referrer", () => {
    const open = vi.fn();
    expect(openExternal("https://files.test/pack.pptx?sig=abc", { open })).toBe(true);
    expect(open).toHaveBeenCalledWith("https://files.test/pack.pptx?sig=abc", "_blank", "noopener,noreferrer");
    expect(String(open.mock.calls[0][2])).toContain("noreferrer");
  });

  it("opens nothing at all when the URL is not safe", () => {
    const open = vi.fn();
    expect(openExternal("javascript:alert(1)", { open })).toBe(false);
    expect(openExternal(null, { open })).toBe(false);
    expect(open).not.toHaveBeenCalled();
  });

  it("names the rel every external link must carry", () => {
    expect(EXTERNAL_REL.split(" ").sort()).toEqual(["noopener", "noreferrer"]);
  });
});

describe("safeFileName", () => {
  it("keeps an ordinary name", () => {
    expect(safeFileName("Brookfield weekly 2026-09.xlsx", "export.xlsx")).toBe("Brookfield weekly 2026-09.xlsx");
  });

  it("strips path separators, so the name cannot escape the download folder", () => {
    expect(safeFileName("../../etc/passwd", "export.csv")).toBe("etc_passwd");
    expect(safeFileName("C:\\Windows\\System32\\evil.exe", "export.csv")).toBe("C_Windows_System32_evil.exe");
  });

  it("strips control characters and the bidi overrides that disguise an extension", () => {
    expect(safeFileName("report\u0000\u001f.csv", "export.csv")).toBe("report.csv");
    expect(safeFileName("annual\u202efdp.exe", "export.csv")).toBe("annualfdp.exe");
    expect(safeFileName("\u200ereport.csv", "export.csv")).toBe("report.csv");
  });

  it("drops leading dots, so it is neither a traversal nor a hidden file", () => {
    expect(safeFileName("..hidden.csv", "export.csv")).toBe("hidden.csv");
    expect(safeFileName(".", "export.csv")).toBe("export.csv");
  });

  it("caps the length and falls back when nothing usable is left", () => {
    expect(safeFileName(`${"a".repeat(400)}.csv`, "export.csv")).toHaveLength(120);
    expect(safeFileName("///", "export.csv")).toBe("export.csv");
    expect(safeFileName("", "export.csv")).toBe("export.csv");
    expect(safeFileName(null, "export.csv")).toBe("export.csv");
  });
});

/**
 * Structural guards. The six sites the security review named are fixed, but
 * the value of one shared helper is that the seventh cannot be written by
 * hand, so the source is scanned rather than only the helper tested.
 */
describe("the application uses the helper everywhere", () => {
  const roots = ["app", "components", "lib", "redux"];
  const sources = roots.flatMap((root) => walk(join(process.cwd(), root)));

  it("finds source files to scan", () => {
    expect(sources.length).toBeGreaterThan(100);
  });

  it("opens no window without the helper", () => {
    const offenders = sources.filter(
      (file) => !file.endsWith(join("lib", "safe-url.ts")) && /\bwindow\.open\s*\(/.test(read(file)),
    );
    expect(offenders.map(relative)).toEqual([]);
  });

  it("never marks a link noopener without noreferrer", () => {
    const offenders = sources.filter((file) => /rel=(["'])noopener\1/.test(read(file)));
    expect(offenders.map(relative)).toEqual([]);
  });
});
