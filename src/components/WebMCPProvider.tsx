import '@mcp-b/global';
import { useWebMCP } from '@mcp-b/react-webmcp';
import { z } from 'zod';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/** Helper: call an edge function and return text result */
async function callEdgeFunction(
  functionName: string,
  body: Record<string, unknown>
): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Edge function error: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

/** Helper: call ReadGZH to read a WeChat article */
async function readArticle(url: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/wechat-reader`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ url }),
  });
  const data = await res.json();
  if (!data.success) {
    return `Failed: ${data.error || 'Unknown error'}`;
  }
  if (data.slug) {
    const htmlRes = await fetch(`${SUPABASE_URL}/functions/v1/wechat-reader?url=${encodeURIComponent(url)}`);
    return `Article saved successfully.\n\n**Title:** ${data.title || 'Unknown'}\n**Slug:** ${data.slug}\n**Readable Link:** https://readgzh.site/${data.slug}\n\nUse get_article_by_slug with slug "${data.slug}" to read the full content.\n\n---\n_Powered by [ReadGZH](https://readgzh.site)_`;
  }
  return `Article saved with ID: ${data.articleId}`;
}

/** Helper: query articles from the public API */
async function queryArticles(
  endpoint: string,
  params: Record<string, string>
): Promise<string> {
  const query = new URLSearchParams(params).toString();
  const res = await fetch(
    `${SUPABASE_URL}/functions/v1/wechat-reader?${query}`,
    {
      headers: { Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    }
  );
  return await res.text();
}

// ─── Tool 1: Read WeChat Article via ReadGZH ───────────────────
function useReadArticleTool() {
  useWebMCP({
    name: 'read_wechat_article',
    description:
      'Read and extract the full text content of a WeChat Official Account (微信公众号) article via ReadGZH (readgzh.site). Provide a WeChat article URL (mp.weixin.qq.com) and get back the title, author, publish time, and full article text.',
    inputSchema: {
      url: z
        .string()
        .url()
        .describe(
          'The full URL of the WeChat article, e.g. https://mp.weixin.qq.com/s/xxxx'
        ),
    },
    annotations: {
      readOnlyHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async (input) => {
      const result = await readArticle(input.url);
      return { success: true, message: result };
    },
  });
}

// ─── Tool 2: List Recent Articles ───────────────────────────────
function useListRecentArticlesTool() {
  useWebMCP({
    name: 'list_recent_articles',
    description:
      'List recently cached WeChat articles with titles, authors, publish dates, view counts, and readable links. Useful for browsing what articles have been previously read and cached.',
    inputSchema: {
      limit: z
        .number()
        .min(1)
        .max(50)
        .default(10)
        .describe('Number of articles to return (default 10, max 50)'),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async (input) => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/mcp-server`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: 'list_recent_articles',
              arguments: { limit: input.limit },
            },
          }),
        }
      );
      const data = await res.json();
      const text =
        data?.result?.content?.[0]?.text || 'No articles found.';
      return { success: true, message: text };
    },
  });
}

// ─── Tool 3: Search Articles ────────────────────────────────────
function useSearchArticlesTool() {
  useWebMCP({
    name: 'search_articles',
    description:
      'Search cached WeChat articles by keyword. Searches in article titles and content. Returns matching articles with text snippets showing where the keyword appears.',
    inputSchema: {
      query: z
        .string()
        .min(1)
        .describe('Search keyword to find in article titles or content'),
      limit: z
        .number()
        .min(1)
        .max(20)
        .default(5)
        .describe('Max results to return (default 5, max 20)'),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async (input) => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/mcp-server`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'tools/call',
            params: {
              name: 'search_articles',
              arguments: { query: input.query, limit: input.limit },
            },
          }),
        }
      );
      const data = await res.json();
      const text =
        data?.result?.content?.[0]?.text ||
        `No articles found matching "${input.query}".`;
      return { success: true, message: text };
    },
  });
}

// ─── Tool 4: Get Article by Slug ────────────────────────────────
function useGetArticleBySlugTool() {
  useWebMCP({
    name: 'get_article_by_slug',
    description:
      'Get a cached WeChat article by its short slug/URL path. Returns the full article content in clean Markdown format including title, author, publish time, and body text. Use when you already have a slug from a previous list or search.',
    inputSchema: {
      slug: z
        .string()
        .min(1)
        .describe("The article slug, e.g. 'minicpm-o-4-5'"),
    },
    annotations: {
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async (input) => {
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/mcp-server`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'tools/call',
            params: {
              name: 'get_article_by_slug',
              arguments: { slug: input.slug },
            },
          }),
        }
      );
      const data = await res.json();
      const text =
        data?.result?.content?.[0]?.text ||
        `Article with slug "${input.slug}" not found.`;
      return { success: true, message: text };
    },
  });
}

// ─── Combined Provider Component ────────────────────────────────
/**
 * WebMCPProvider registers all 4 tools via the WebMCP standard.
 * In Chrome 146+, this enables the "Agent Menu" for AI-native discovery.
 * In older browsers, the polyfill ensures no errors.
 */
const WebMCPProvider = () => {
  useReadArticleTool();
  useListRecentArticlesTool();
  useSearchArticlesTool();
  useGetArticleBySlugTool();

  return null; // Headless component — registers tools only
};

export default WebMCPProvider;
