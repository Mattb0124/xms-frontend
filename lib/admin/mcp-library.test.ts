import { describe, expect, it } from "vitest";
import {
  describeSaveRefusal,
  serverAddress,
  serverFromDraft,
  withoutServer,
  withServer,
  type McpLibraryBody,
  type McpServerDefinition,
} from "@/lib/admin/mcp-library";

const XMS: McpServerDefinition = {
  slug: "xms",
  name: "XMS",
  transport: "streamable_http",
  url: "https://api.xms.example/mcp",
  caller_token: true,
};
const ONESTREAM: McpServerDefinition = {
  slug: "onestream-brk",
  name: "OneStream (Brookfield)",
  transport: "stdio",
  command: "onestream-mcp",
  secret_ref: "xms/dev/mcp/onestream-brk",
};
const LIBRARY: McpLibraryBody = { servers: [XMS, ONESTREAM], enabled: ["xms", "onestream-brk"] };

describe("serverAddress", () => {
  it("reads the URL over HTTP and the command over stdio", () => {
    expect(serverAddress(XMS)).toBe("https://api.xms.example/mcp");
    expect(serverAddress(ONESTREAM)).toBe("onestream-mcp");
  });
});

describe("serverFromDraft", () => {
  it("keeps the headers typed and trims the secret reference", () => {
    const saved = serverFromDraft({ ...ONESTREAM, secret_ref: "  xms/dev/mcp/brk  " }, "X-Account: BRK");
    expect(saved.headers).toEqual({ "X-Account": "BRK" });
    expect(saved.secret_ref).toBe("xms/dev/mcp/brk");
  });

  it("sends no headers when none were typed and a blank secret reference as none", () => {
    const saved = serverFromDraft({ ...ONESTREAM, headers: { Stale: "1" }, secret_ref: "   " }, "");
    expect(saved.headers).toBeUndefined();
    expect(saved.secret_ref).toBeNull();
  });
});

describe("withServer", () => {
  it("adds a connection where nothing was opened, leaving the enabled list alone", () => {
    const added: McpServerDefinition = { ...XMS, slug: "jira", name: "Jira" };
    expect(withServer(LIBRARY, added, null)).toEqual({
      servers: [XMS, ONESTREAM, added],
      enabled: ["xms", "onestream-brk"],
    });
  });

  it("replaces the connection opened and carries its enabled state across a rename", () => {
    const renamed = { ...ONESTREAM, slug: "onestream-brookfield" };
    expect(withServer(LIBRARY, renamed, "onestream-brk")).toEqual({
      servers: [XMS, renamed],
      enabled: ["xms", "onestream-brookfield"],
    });
  });
});

describe("withoutServer", () => {
  it("drops the connection from the catalog and from the enabled list", () => {
    expect(withoutServer(LIBRARY, "onestream-brk")).toEqual({ servers: [XMS], enabled: ["xms"] });
  });
});

describe("describeSaveRefusal", () => {
  it("lists the server's problems in its own words", () => {
    const refusal = { status: 400, data: { code: "invalid_config", problems: ["slug taken", "url not https"] } };
    expect(describeSaveRefusal(refusal)).toBe("slug taken; url not https");
  });

  it("falls back to one plain sentence when the server named nothing", () => {
    expect(describeSaveRefusal({ status: 500, data: { code: "error" } })).toBe("That could not be saved.");
    expect(describeSaveRefusal(new Error("offline"))).toBe("That could not be saved.");
  });
});
