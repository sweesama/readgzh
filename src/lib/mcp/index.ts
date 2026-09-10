import { auth, defineMcp } from "@lovable.dev/mcp-js";
import readTool from "./tools/read";
import searchTool from "./tools/search";
import listRecentTool from "./tools/list-recent";
import listByAccountTool from "./tools/list-by-account";
import getTool from "./tools/get";

// The OAuth issuer must be the direct Supabase host, built from the project ref.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "readgzh",
  title: "ReadGZH",
  version: "1.0.0",
  instructions:
    "ReadGZH reads WeChat Official Account (微信公众号) articles that ordinary web fetches cannot open. Use readgzh_read for an mp.weixin.qq.com link, readgzh_search / readgzh_list / readgzh_list_by_account to browse articles already cached by ReadGZH, and readgzh_get to re-read a cached article by slug (free, chunked for long articles). Cached reads cost nothing; a fresh extraction costs 3 credits from the signed-in user's ReadGZH balance. Cache listings are never a complete archive of an account.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [readTool, searchTool, listRecentTool, listByAccountTool, getTool],
});
