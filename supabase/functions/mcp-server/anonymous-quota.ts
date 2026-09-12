// Protocol discovery is bounded separately from tools that read or change data.
// Sixty complete (initialize + initialized + tools/list + ping) checks per day
// fit in this initial daily budget. It is not an exemption from abuse protection.
const DISCOVERY_DAILY_LIMIT = 240;
const TOOL_DAILY_LIMIT = 10;
const DISCOVERY_METHODS = new Set(["initialize", "notifications/initialized", "tools/list", "ping"]);

export interface AnonymousQuota {
  key: string;
  limit: number;
  discovery: boolean;
}

export async function anonymousQuota(request: Request, ip: string): Promise<AnonymousQuota> {
  let discovery = false;
  try {
    const rpc: unknown = await request.clone().json();
    if (rpc && typeof rpc === "object" && !Array.isArray(rpc)) {
      const message = rpc as Record<string, unknown>;
      discovery = message.jsonrpc === "2.0" && typeof message.method === "string" && DISCOVERY_METHODS.has(message.method);
    }
  } catch {
    // Malformed and unknown requests retain the existing, stricter tool budget.
  }
  return discovery
    ? { key: `mcp-discovery:${ip}`, limit: DISCOVERY_DAILY_LIMIT, discovery }
    : { key: ip, limit: TOOL_DAILY_LIMIT, discovery };
}
