import { describe, expect, it } from "vitest";
import { anonymousQuota } from "../../supabase/functions/mcp-server/anonymous-quota";

const request = (body: unknown) => new Request("https://example.test/mcp", { method: "POST", body: JSON.stringify(body) });
const rpc = (method: string) => ({ jsonrpc: "2.0", id: 1, method });

describe("anonymous MCP discovery isolation", () => {
  it("allows a full handshake after tool allowance exhaustion, without resetting that allowance", async () => {
    const usage = new Map<string, number>([["192.0.2.1", 10]]);
    const consume = async (body: unknown) => {
      const quota = await anonymousQuota(request(body), "192.0.2.1");
      const count = (usage.get(quota.key) ?? 0) + 1;
      usage.set(quota.key, count);
      return count <= quota.limit;
    };
    for (const method of ["initialize", "notifications/initialized", "tools/list", "ping"]) expect(await consume(rpc(method))).toBe(true);
    expect(usage.get("192.0.2.1")).toBe(10);
    expect(await consume({ ...rpc("tools/call"), params: { name: "readgzh.read", arguments: { url: "https://example.test/article" } } })).toBe(false);
  });

  it("keeps discovery finite and cannot spend the tool pool when discovery is exhausted", async () => {
    const discovery = await anonymousQuota(request(rpc("tools/list")), "192.0.2.1");
    const tool = await anonymousQuota(request(rpc("tools/call")), "192.0.2.1");
    expect(Number.isSafeInteger(discovery.limit)).toBe(true);
    expect(discovery.limit).toBeGreaterThan(0);
    expect(discovery.key).not.toBe(tool.key);
    expect(tool).toEqual({ key: "192.0.2.1", limit: 10, discovery: false });
  });

  it.each([
    [{ ...rpc("tools/call"), params: { name: "ping" } }],
    [[rpc("initialize"), rpc("tools/call")]],
    [{ method: "initialize" }],
    [rpc("resources/read")],
    [rpc("unknown")],
    [null],
  ])("keeps tool calls, batches, invalid envelopes and unknown methods on the original limit: %j", async body => {
    expect((await anonymousQuota(request(body), "192.0.2.1")).discovery).toBe(false);
  });

  it("does not consume the transport's request body and handles malformed JSON", async () => {
    const original = request(rpc("initialize"));
    await anonymousQuota(original, "192.0.2.1");
    expect(await original.json()).toEqual(rpc("initialize"));
    const malformed = new Request("https://example.test/mcp", { method: "POST", body: "{" });
    expect((await anonymousQuota(malformed, "192.0.2.1")).discovery).toBe(false);
  });
});
