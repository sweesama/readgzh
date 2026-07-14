import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.38/deno-dom-wasm.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "X-Powered-By": "ReadGZH (readgzh.site)",
};

// ===== Standardized API error response with actionable guidance =====
// Every user-facing error should go through this helper so clients always
// see a `code`, a human-readable `message`, a `hint`, and links to docs /
// dashboard. This prevents "tool failed" black-box errors in MCP / API clients.
function apiError(opts: {
  code: string;
  message: string;
  status: number;
  hint?: string;
  extras?: Record<string, unknown>;
  contentType?: string;
}): Response {
  const body = {
    success: false,
    code: opts.code,
    error: opts.code,
    message: opts.message,
    hint: opts.hint ?? "如需帮助，请查看开发者文档或访问控制台获取 API Key。",
    dashboard_url: "https://readgzh.site/dashboard",
    docs_url: "https://readgzh.site/docs",
    pricing_url: "https://readgzh.site/pricing",
    support_url: "https://readgzh.site/#feedback",
    ...(opts.extras ?? {}),
  };
  return new Response(JSON.stringify(body), {
    status: opts.status,
    headers: {
      ...corsHeaders,
      "Content-Type": opts.contentType ?? "application/json",
    },
  });
}

// Standardized response for WeChat security/verification interception.
function wechatVerificationError(sourceUrl?: string): Response {
  return apiError({
    code: "wechat_verification",
    status: 403,
    message: "微信服务器当前对该文章触发了临时访问保护，这是微信的正常安全机制，通常 3-5 分钟后会自动恢复。",
    hint: "建议：1）稍等 3-5 分钟后重试同一篇文章；2）先读其他文章，稍后再回来；3）在微信内打开后使用首页的「书签提取工具」手动提交（不受此限制）。",
    extras: { source_url: sourceUrl, bookmarklet_url: "https://readgzh.site/#bookmarklet", retry_after_seconds: 300 },
  });
}

// ===== Video-only article detection =====
// A WeChat article whose #js_content contains a video iframe but essentially
// no readable text. Firecrawl fallback would only pull page-chrome noise, so
// we short-circuit and return a clear error with a refund.
function isVideoOnlyArticle(html: string, textContent: string): boolean {
  const stripped = (textContent || "").replace(/\s+/g, "").trim();
  if (stripped.length >= 120) return false; // has real text alongside the video
  const hasVideoIframe =
    /<iframe[^>]*class="[^"]*video_iframe/i.test(html) ||
    /<iframe[^>]*data-mpvid=/i.test(html) ||
    /v\.qq\.com\/(txp|iframe)/i.test(html) ||
    /mp_video_trans_info/i.test(html);
  return hasVideoIframe;
}

// Refund credits when a scrape fails after upfront deduction. Best-effort.
async function refundCredits(keyHash: string | undefined, amount: number): Promise<boolean> {
  if (!keyHash || amount <= 0) return false;
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error } = await supabase.rpc("refund_credits", { p_key_hash: keyHash, p_amount: amount });
    if (error) {
      console.error("Refund failed:", error);
      return false;
    }
    console.log(`Refunded ${amount} credits to key ${keyHash.substring(0, 8)}...`);
    return true;
  } catch (err) {
    console.error("Refund error:", err);
    return false;
  }
}


// Check if content indicates a verification/captcha page
function isVerificationPage(text: string): boolean {
  const patterns = [
    "环境异常",
    "完成验证",
    "去验证",
    "验证码",
    "请完成安全验证",
    "访问过于频繁",
    "拖动下方滑块完成拼图",
    "网络确认身份",
    "滑块验证",
    "请拖动滑块",
    "complete the security check",
    "please verify",
  ];
  const lower = text.toLowerCase();
  // If 2+ patterns match, it's almost certainly a verification page
  let matchCount = 0;
  for (const p of patterns) {
    if (lower.includes(p.toLowerCase())) matchCount++;
    if (matchCount >= 2) return true;
  }
  // Single match is enough for known strong signals
  const strongSignals = ["环境异常", "请完成安全验证", "访问过于频繁"];
  return strongSignals.some((p) => lower.includes(p));
}

// Check if WeChat returned an error page (deleted/invalid article)
function isWeChatErrorPage(html: string): string | null {
  // These patterns indicate actual error *content* displayed to the user,
  // NOT template CSS class names that appear in every WeChat page.
  const errorPatterns: [string, string][] = [
    ["该内容已被发布者删除", "该文章已被发布者删除。"],
    ["此内容因违规无法查看", "该文章因违规已被微信删除。"],
    ["此内容被投诉且经审核涉嫌侵权", "该文章因侵权投诉已被删除。"],
    ["该公众号已被封禁", "该公众号已被封禁，文章不可访问。"],
    ["此帐号已被屏蔽", "该帐号已被屏蔽，文章不可访问。"],
    ["page_rumor", "该文章已被标记为不实信息。"],
    // English error pages (browser-rendered error or WeChat international)
    ["This mp.weixin.qq.com page can\u2019t be found", "文章链接无效或已被删除（404）。"],
    ["This mp.weixin.qq.com page can't be found", "文章链接无效或已被删除（404）。"],
    ["page can not be found", "文章链接无效或已被删除（404）。"],
    ["HTTP ERROR 404", "文章链接无效或已被删除（404）。"],
    ["No webpage was found", "文章链接无效或已被删除（404）。"],
  ];
  for (const [pattern, message] of errorPatterns) {
    if (html.includes(pattern)) return message;
  }

  // Check for WeChat's actual error page structure (not just CSS class presence).
  if (!html.includes('id="js_content"') && !html.includes("picture_page_info_list")) {
    if (html.includes("weui-msg") || html.includes("Parameter error")) {
      return "微信返回了错误页面，文章可能已被删除或链接无效。";
    }
  }

  return null;
}

// Allowed tags for sanitization
const ALLOWED_TAGS = new Set([
  "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
  "strong", "b", "em", "i", "u", "s",
  "blockquote", "ul", "ol", "li",
  "img", "figure", "figcaption",
  "section", "div", "span",
  "table", "thead", "tbody", "tr", "th", "td",
  "a", "sup", "sub", "hr",
]);

// ===== Picture Template (小绿书) Support =====
// Detect and extract content from WeChat picture/album posts
// These posts have no #js_content; data lives in window.picture_page_info_list and og:description

function isPictureTemplate(html: string): boolean {
  return html.includes("picture_page_info_list") && !html.includes('id="js_content"');
}

interface PicturePageInfo {
  cdn_url: string;
  width: number;
  height: number;
}

// Decode WeChat's \xNN escape sequences commonly used in picture template data
function decodeWeChatEscapes(s: string): string {
  return s
    .replace(/\\x0a/g, "\n")
    .replace(/\\x26amp;/g, "&")
    .replace(/\\x26quot;/g, '"')
    .replace(/\\x26gt;/g, ">")
    .replace(/\\x26lt;/g, "<")
    .replace(/\\x26nbsp;/g, " ")
    .replace(/\\x26/g, "&")
    .replace(/\\x27/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function extractPictureTemplate(html: string): { contentHtml: string; textContent: string; images: PicturePageInfo[] } | null {
  if (!isPictureTemplate(html)) return null;

  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return null;

  // Extract text: try og:description first, then text_page_info.content (JsDecode wrapped)
  let textContent = "";
  const ogDesc = doc.querySelector('meta[property="og:description"]');
  if (ogDesc) {
    textContent = decodeWeChatEscapes((ogDesc as Element).getAttribute("content") || "");
  }

  // If og:description is empty or very short, try text_page_info: { content: JsDecode('...') }
  if (!textContent || textContent.length < 50) {
    // Try multiple patterns for text_page_info extraction
    const patterns = [
      /text_page_info\s*:\s*\{[\s\S]*?content\s*:\s*JsDecode\('([\s\S]*?)'\)/,
      /text_page_info\s*=\s*\{[\s\S]*?content\s*:\s*JsDecode\('([\s\S]*?)'\)/,
      /text_page_info[\s\S]*?JsDecode\('([\s\S]*?)'\)/,
    ];
    for (const pattern of patterns) {
      const textPageMatch = html.match(pattern);
      if (textPageMatch && textPageMatch[1].length > (textContent?.length || 0)) {
        textContent = decodeWeChatEscapes(textPageMatch[1]);
        console.log(`Extracted text from text_page_info (${textContent.length} chars)`);
        break;
      }
    }
  }
  
  console.log(`Picture template extraction: og:description=${ogDesc ? 'found' : 'missing'}, textContent=${textContent.length} chars`);

  // Extract picture list from picture_page_info_list (supports both window.X = [] and X: [] formats)
  // Use bracket-counting to handle nested arrays/objects correctly
  const images: PicturePageInfo[] = [];
  const listStartMatch = html.match(/picture_page_info_list\s*(?:=|:)\s*\[/);
  if (listStartMatch) {
    const startIdx = (listStartMatch.index ?? 0) + listStartMatch[0].length;
    // Find the matching closing bracket using bracket counting
    let depth = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < html.length && depth > 0; i++) {
      if (html[i] === '[') depth++;
      else if (html[i] === ']') depth--;
      if (depth === 0) endIdx = i;
    }
    const listContent = html.substring(startIdx, endIdx).trim();
    if (listContent.length > 10) {
      // Split by top-level object boundaries
      const entries = listContent.split(/\},\s*\n\s*\{/);
      for (const entry of entries) {
        // Support both cdn_url: 'xxx' and cdn_url: JsDecode('xxx') formats
        // Support both width: 'N' and width: 'N' * 1 formats
        const cdnUrlMatch = entry.match(/cdn_url:\s*(?:JsDecode\()?'([^']+)'\)?/);
        const widthMatch = entry.match(/width:\s*'(\d+)'/);
        const heightMatch = entry.match(/height:\s*'(\d+)'/);
        if (cdnUrlMatch && widthMatch && heightMatch) {
          images.push({
            cdn_url: decodeWeChatEscapes(cdnUrlMatch[1]),
            width: parseInt(widthMatch[1]),
            height: parseInt(heightMatch[1]),
          });
        }
      }
    }
  }

  if (!textContent && images.length === 0) return null;

  // Build HTML content with images and text
  const proxyBase = `https://api.readgzh.site/image-proxy?url=`;
  const imgHtml = images
    .map((img) => {
      const proxied = `${proxyBase}${encodeURIComponent(img.cdn_url)}`;
      return `<figure><img src="${proxied}" width="${img.width}" height="${img.height}" alt="图片" style="max-width:100%;height:auto;" /></figure>`;
    })
    .join("\n");

  const textHtml = textContent
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `<p>${l}</p>`)
    .join("\n");

  const contentHtml = imgHtml + (textHtml ? `\n<div class="picture-text">${textHtml}</div>` : "");

  return { contentHtml, textContent, images };
}

// ===== Short Text Template (公众号短文/动态) Support =====
// Detect and extract content from WeChat short-text posts (item_show_type = 10 or 17).
// These posts have NO #js_content — the full body lives inside an inline JS data
// block as `content_noencode: '...'`, along with `title`, `nick_name` and an optional
// `short_msg_pic_url` image list. Everything is present in the initial HTML, so a
// plain direct-fetch (no Firecrawl, no headless browser) can extract it fully.

function isShortTextTemplate(html: string): boolean {
  if (html.includes('id="js_content"')) return false;
  // Primary signal: WeChat sets window.item_show_type = '10' | '17' for short posts.
  if (/window\.(?:real_)?item_show_type\s*=\s*'(?:10|17)'/.test(html)) return true;
  // Secondary signal: the inline data block field is present with content.
  return /content_noencode\s*:\s*'[^']{20,}/.test(html);
}

// Decode common JS/HTML escape sequences found inside content_noencode.
function decodeJsStringEscapes(s: string): string {
  return s
    .replace(/\\\\/g, "\\")
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Extract the raw JS single-quoted string value for `fieldName:` starting at `fromIndex`.
// Returns { value, endIndex } or null. Handles \' and \\ escapes.
function readJsSingleQuotedString(html: string, fromIndex: number): { value: string; endIndex: number } | null {
  let i = fromIndex;
  let out = "";
  while (i < html.length) {
    const c = html[i];
    if (c === "\\") {
      // keep the backslash + next char verbatim; decode later
      out += c + (html[i + 1] ?? "");
      i += 2;
      continue;
    }
    if (c === "'") return { value: out, endIndex: i };
    out += c;
    i++;
  }
  return null;
}

function extractJsField(html: string, fieldName: string, preferLastBefore?: number): string | null {
  const re = new RegExp(`\\b${fieldName}\\s*:\\s*'`, "g");
  let match: RegExpExecArray | null = null;
  let best: RegExpExecArray | null = null;
  while ((match = re.exec(html)) !== null) {
    if (preferLastBefore !== undefined && match.index > preferLastBefore) break;
    best = match;
    if (preferLastBefore === undefined) break;
  }
  if (!best) return null;
  const parsed = readJsSingleQuotedString(html, best.index + best[0].length);
  if (!parsed) return null;
  return decodeJsStringEscapes(parsed.value);
}

function extractShortTextTemplate(html: string): { contentHtml: string; textContent: string; title: string; author: string; images: PicturePageInfo[] } | null {
  if (!isShortTextTemplate(html)) return null;

  const contentIdx = html.search(/content_noencode\s*:\s*'/);
  if (contentIdx < 0) return null;
  const quoteIdx = html.indexOf("'", contentIdx);
  const parsed = readJsSingleQuotedString(html, quoteIdx + 1);
  if (!parsed) return null;
  const textContent = decodeJsStringEscapes(parsed.value).trim();
  if (!textContent || textContent.length < 10) return null;

  // Title / author: use fields closest before content_noencode (same data block)
  const title = extractJsField(html, "title", contentIdx) || "";
  const author = extractJsField(html, "nick_name", contentIdx) || "";

  // Optional pictures attached to the short post (short_msg_pic_url: [ { cdn_url: '...', w:'..', h:'..' }, ... ])
  const images: PicturePageInfo[] = [];
  const listMatch = html.match(/short_msg_pic_url\s*:\s*\[/);
  if (listMatch && listMatch.index !== undefined) {
    const startIdx = listMatch.index + listMatch[0].length;
    let depth = 1;
    let endIdx = startIdx;
    for (let i = startIdx; i < html.length && depth > 0; i++) {
      if (html[i] === "[") depth++;
      else if (html[i] === "]") depth--;
      if (depth === 0) { endIdx = i; break; }
    }
    const listContent = html.substring(startIdx, endIdx);
    const entryRe = /\{[\s\S]*?\}/g;
    let em: RegExpExecArray | null;
    while ((em = entryRe.exec(listContent)) !== null) {
      const entry = em[0];
      const cdn = entry.match(/cdn_url\s*:\s*'([^']+)'/);
      const w = entry.match(/\bw(?:idth)?\s*:\s*'(\d+)'/);
      const h = entry.match(/\bh(?:eight)?\s*:\s*'(\d+)'/);
      if (cdn) {
        images.push({
          cdn_url: decodeJsStringEscapes(cdn[1]),
          width: w ? parseInt(w[1]) : 0,
          height: h ? parseInt(h[1]) : 0,
        });
      }
    }
  }

  const proxyBase = `https://api.readgzh.site/image-proxy?url=`;
  const imgHtml = images
    .map((img) => {
      const proxied = `${proxyBase}${encodeURIComponent(img.cdn_url)}`;
      const dims = img.width && img.height ? ` width="${img.width}" height="${img.height}"` : "";
      return `<figure><img src="${proxied}"${dims} alt="图片" style="max-width:100%;height:auto;" /></figure>`;
    })
    .join("\n");

  const textHtml = textContent
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => `<p>${l}</p>`)
    .join("\n");

  const contentHtml = (imgHtml ? imgHtml + "\n" : "") + `<div class="short-text-content">${textHtml}</div>`;

  return { contentHtml, textContent, title, author, images };
}

// WeChat security/safety notice patterns to strip before content validation
const WECHAT_NOISE_PATTERNS = [
  /以下内容来自[\s\S]*?的转载/g,
  /以上内容由[\s\S]*?提供/g,
  /微信安全提示[\s\S]*?(?:。|$)/g,
  /该内容仅[\s\S]*?可见/g,
  /点击上方[\s\S]*?关注/g,
  /长按识别[\s\S]*?二维码/g,
];

// Strip WeChat boilerplate/noise text to get actual article text
function stripNoiseText(text: string): string {
  let cleaned = text;
  for (const pattern of WECHAT_NOISE_PATTERNS) {
    cleaned = cleaned.replace(pattern, "");
  }
  return cleaned.replace(/\s+/g, " ").trim();
}

// Recursively extract text from DOM nodes, handling custom/non-standard tags like <leaf>, <text>, etc.
function deepExtractText(el: Element): string {
  const parts: string[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child.nodeType === 3) { // TEXT_NODE
      const t = (child as unknown as { textContent: string }).textContent || "";
      if (t.trim()) parts.push(t);
    } else if (child.nodeType === 1) { // ELEMENT_NODE
      const childEl = child as unknown as Element;
      const tagName = childEl.tagName?.toLowerCase() || "";
      // Skip hidden elements
      const style = childEl.getAttribute?.("style") || "";
      if (style.includes("display:none") || style.includes("display: none") ||
          style.includes("visibility:hidden") || style.includes("visibility: hidden")) {
        continue;
      }
      // Recursively extract from any element including non-standard ones
      const childText = deepExtractText(childEl);
      if (childText.trim()) {
        // Add paragraph breaks for block-level elements
        if (["p", "div", "section", "blockquote", "h1", "h2", "h3", "h4", "h5", "h6", "li", "br"].includes(tagName)) {
          parts.push("\n" + childText + "\n");
        } else {
          parts.push(childText);
        }
      }
    }
  }
  return parts.join("");
}

// Clean and extract formatted HTML from WeChat content
function extractFormattedContent(html: string): { contentHtml: string; textContent: string } {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { contentHtml: "", textContent: "" };

  const contentEl = doc.querySelector("#js_content");
  if (!contentEl) return { contentHtml: "", textContent: "" };

  // Get inner HTML
  let contentHtml = (contentEl as Element).innerHTML || "";

  // Convert data-src to src for images (WeChat lazy loading)
  contentHtml = contentHtml.replace(/data-src="([^"]+)"/g, 'src="$1"');
  
  // Remove data-* attributes except src
  contentHtml = contentHtml.replace(/\s+data-\w+(?:-\w+)*="[^"]*"/g, "");

  // Remove script and style tags and their content
  contentHtml = contentHtml.replace(/<script[\s\S]*?<\/script>/gi, "");
  contentHtml = contentHtml.replace(/<style[\s\S]*?<\/style>/gi, "");
  contentHtml = contentHtml.replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Remove onclick and other event handlers
  contentHtml = contentHtml.replace(/\s+on\w+="[^"]*"/g, "");

  // Remove WeChat-specific noise
  contentHtml = contentHtml.replace(/visibility:\s*hidden[^;]*;?/g, "");
  contentHtml = contentHtml.replace(/opacity:\s*0[^;]*;?/g, "");

  // Remove empty spans with only nbsp
  contentHtml = contentHtml.replace(/<span[^>]*>\s*(&nbsp;|\s)*\s*<\/span>/gi, "");

  // Remove excessive inline styles but keep basic ones
  contentHtml = contentHtml.replace(/javascript:/gi, "");

  // Use deep recursive text extraction to handle nested <span>, <leaf>, <text>, etc.
  const textContent = deepExtractText(contentEl as Element).replace(/\n{3,}/g, "\n\n").trim();

  // Fallback: if deep extraction somehow got less than basic textContent, use the basic one
  const basicText = (contentEl as Element).textContent?.trim() || "";
  const finalText = textContent.length >= basicText.length ? textContent : basicText;

  return { contentHtml: contentHtml.trim(), textContent: finalText };
}

// Extract metadata from WeChat HTML
function extractMetadata(html: string) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  if (!doc) return { title: "无标题", author: "公众号文章", publishTime: null };

  // Title
  let title = "";
  const titleEl = doc.querySelector("#activity-name");
  if (titleEl) title = (titleEl as Element).textContent?.trim() || "";
  if (!title) {
    const ogTitle = doc.querySelector('meta[property="og:title"]');
    if (ogTitle) title = (ogTitle as Element).getAttribute("content") || "";
  }
  if (!title) {
    const titleTag = doc.querySelector("title");
    if (titleTag) {
      title = (titleTag as Element).textContent?.trim() || "";
      title = title.replace(/\s*[-|_]\s*微信公众平台.*$/, "").trim();
    }
  }

  // Author
  let author = "";
  const authorEl = doc.querySelector("#js_name");
  if (authorEl) author = (authorEl as Element).textContent?.trim() || "";
  if (!author) {
    const ogAuthor = doc.querySelector('meta[property="og:article:author"]');
    if (ogAuthor) author = (ogAuthor as Element).getAttribute("content") || "";
  }

  // Publish time - try multiple extraction methods
  let publishTime = null;
  // Method 1: DOM element (works when JS has rendered)
  const pubTimeEl = doc.querySelector("#publish_time");
  if (pubTimeEl) publishTime = (pubTimeEl as Element).textContent?.trim() || null;
  // Method 2: Extract from raw HTML script variables (works for static fetch)
  if (!publishTime) {
    // Try var ct = "timestamp" (Unix seconds) - standard articles
    const ctMatch = html.match(/var\s+ct\s*=\s*"(\d{10})"/);
    if (ctMatch) {
      const ts = parseInt(ctMatch[1], 10);
      const chinaOffsetMs = 8 * 60 * 60 * 1000;
      const d = new Date(ts * 1000 + chinaOffsetMs);
      publishTime = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
  }
  if (!publishTime) {
    // Try create_time in picture template pages (小绿书) - e.g. var create_time = "1709654400" or create_time = "timestamp"
    const createTimeMatch = html.match(/(?:var\s+)?create_time\s*=\s*"(\d{10})"/);
    if (createTimeMatch) {
      const ts = parseInt(createTimeMatch[1], 10);
      const chinaOffsetMs = 8 * 60 * 60 * 1000;
      const d = new Date(ts * 1000 + chinaOffsetMs);
      publishTime = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
  }
  if (!publishTime) {
    // Try any 10-digit unix timestamp near "ct" or "publish_time" or "create_time" keywords
    const genericTsMatch = html.match(/(?:ct|publish_time|create_time|oriCreateTime|createTime)\s*[:=]\s*['"]*(\d{10})['"]/);
    if (genericTsMatch) {
      const ts = parseInt(genericTsMatch[1], 10);
      const chinaOffsetMs = 8 * 60 * 60 * 1000;
      const d = new Date(ts * 1000 + chinaOffsetMs);
      publishTime = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")} ${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
    }
  }
  if (!publishTime) {
    // Try var publish_time = "2026-03-05" or similar
    const ptMatch = html.match(/var\s+publish_time\s*=\s*"([^"]+)"/);
    if (ptMatch) publishTime = ptMatch[1];
  }
  if (!publishTime) {
    // Try meta tag og:article:published_time
    const metaPubTime = doc.querySelector('meta[property="article:published_time"]');
    if (metaPubTime) publishTime = (metaPubTime as Element).getAttribute("content") || null;
  }

  return {
    title: title || "无标题",
    author: author || "公众号文章",
    publishTime,
  };
}

// Direct fetch with browser-like headers
async function tryDirectFetch(url: string): Promise<string | null> {
  console.log("Attempting direct fetch with browser headers");
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
        "Sec-Ch-Ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1",
      },
      redirect: "follow",
    });

    if (!response.ok) {
      console.log("Direct fetch failed:", response.status);
      return null;
    }

    const html = await response.text();
    console.log("Direct fetch HTML length:", html.length);
    return html;
  } catch (error) {
    console.error("Direct fetch error:", error);
    return null;
  }
}

// Firecrawl fallback - returns { html, markdown } for maximum extraction
async function tryFirecrawl(url: string, apiKey: string): Promise<{ html: string | null; markdown: string | null }> {
  console.log("Attempting Firecrawl fallback");
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url,
        formats: ["html", "markdown"],
        onlyMainContent: true,
        waitFor: 15000,
        location: { country: "CN", languages: ["zh-CN", "zh"] },
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Firecrawl error:", data);
      return { html: null, markdown: null };
    }

    const html = data.data?.html || data.html || "";
    const markdown = data.data?.markdown || data.markdown || "";
    console.log("Firecrawl HTML length:", html.length, "Markdown length:", markdown.length);
    return { html: html || null, markdown: markdown || null };
  } catch (error) {
    console.error("Firecrawl error:", error);
    return { html: null, markdown: null };
  }
}

// ===== Article Read Mode: Return static HTML for AI bots =====
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatContentToHtml(text: string): string {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
}

// Replace video iframes with accessible links for SSR output
function replaceVideoIframesForSsr(html: string, sourceUrl?: string | null): string {
  const proxyBase = `https://api.readgzh.site/image-proxy?url=`;
  let result = html.replace(
    /<iframe[^>]*class="video_iframe[^"]*"[^>]*>/gi,
    (match) => {
      // Extract cover image
      const coverMatch = match.match(/data-cover="([^"]*)"/);
      const coverUrl = coverMatch ? coverMatch[1].replace(/&amp;/g, "&") : null;
      const proxiedCover = coverUrl ? `${proxyBase}${encodeURIComponent(coverUrl)}` : null;
      const linkUrl = sourceUrl || "#";

      if (proxiedCover) {
        return `<div style="border:1px solid #ddd;border-radius:8px;overflow:hidden;margin:16px 0;">` +
          `<a href="${linkUrl}" target="_blank" rel="noopener" style="display:block;text-decoration:none;color:inherit;">` +
          `<div style="position:relative;background:#000;text-align:center;"><img src="${proxiedCover}" style="max-width:100%;opacity:0.85;" alt="视频封面"/><span style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:3em;">▶️</span></div>` +
          `<div style="padding:10px 16px;background:#f9f9f9;font-size:0.9em;">📹 点击查看原文播放视频</div>` +
          `</a></div>`;
      }
      // No cover: compact inline link
      return `<div style="margin:12px 0;padding:10px 16px;border:1px solid #ddd;border-radius:8px;background:#f9f9f9;display:flex;align-items:center;gap:8px;">` +
        `<span>📹</span>` +
        `<a href="${linkUrl}" target="_blank" rel="noopener"><b>点击查看原文播放视频 →</b></a>` +
        `</div>`;
    }
  );
  result = result.replace(/<\/iframe>/gi, "");
  result = result.replace(/<iframe[\s\S]*?<\/iframe>/gi, "");
  return result;
}

// Proxy WeChat image URLs for SSR output
function proxyImagesForSsr(html: string): string {
  const proxyBase = `https://api.readgzh.site/image-proxy?url=`;
  return html.replace(
    /src="(https?:\/\/mmbiz\.qpic\.cn[^"]*)"/g,
    (_, url: string) => {
      const decoded = url.replace(/&amp;/g, "&");
      return `src="${proxyBase}${encodeURIComponent(decoded)}"`;
    }
  );
}

// Split content into chunks for ?part=N pagination
const PART_SIZE = 40000; // ~40KB per part

function splitIntoParts(content: string): string[] {
  if (content.length <= PART_SIZE) return [content];
  const parts: string[] = [];
  let i = 0;
  while (i < content.length) {
    let end = Math.min(i + PART_SIZE, content.length);
    // Try to break at a paragraph boundary to avoid splitting mid-tag
    if (end < content.length) {
      const lastP = content.lastIndexOf("</p>", end);
      const lastDiv = content.lastIndexOf("</div>", end);
      const lastNewline = content.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastP > i ? lastP + 4 : -1, lastDiv > i ? lastDiv + 6 : -1, lastNewline > i ? lastNewline + 1 : -1);
      if (breakPoint > i) end = breakPoint;
    }
    parts.push(content.substring(i, end));
    i = end;
  }
  return parts;
}

// Convert HTML content to clean Markdown text
function htmlToMarkdown(html: string, title: string, author: string, publishTime: string | null, sourceUrl: string | null): string {
  let md = `# ${title}\n\n`;
  md += `**作者：** ${author}\n`;
  if (publishTime) md += `**发布时间：** ${publishTime}\n`;
  md += `\n---\n\n`;

  // Strip all HTML tags, convert common ones to Markdown
  let text = html;
  // Headers
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_, c) => `# ${c.trim()}\n\n`);
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_, c) => `## ${c.trim()}\n\n`);
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_, c) => `### ${c.trim()}\n\n`);
  text = text.replace(/<h[4-6][^>]*>([\s\S]*?)<\/h[4-6]>/gi, (_, c) => `#### ${c.trim()}\n\n`);
  // Bold/italic
  text = text.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, c) => `**${c.trim()}**`);
  text = text.replace(/<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi, (_, _t, c) => `*${c.trim()}*`);
  // Links
  text = text.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, c) => `[${c.trim()}](${href})`);
  // Images → Markdown format with URL preserved for multi-modal AI
  text = text.replace(/<img[^>]*?(?:data-src|src)="([^"]*)"[^>]*?alt="([^"]*)"[^>]*?\/?>/gi, (_, src, alt) => `![${alt || '图片'}](${src})`);
  text = text.replace(/<img[^>]*?alt="([^"]*)"[^>]*?(?:data-src|src)="([^"]*)"[^>]*?\/?>/gi, (_, alt, src) => `![${alt || '图片'}](${src})`);
  text = text.replace(/<img[^>]*?(?:data-src|src)="([^"]*)"[^>]*?\/?>/gi, (_, src) => `![图片](${src})`);
  text = text.replace(/<img[^>]*\/?>/gi, '');
  // Figures with images already converted above
  text = text.replace(/<figure[^>]*>[\s\S]*?<\/figure>/gi, '');
  // Line breaks / paragraphs
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<\/li>/gi, '\n');
  text = text.replace(/<li[^>]*>/gi, '- ');
  text = text.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => c.trim().split('\n').map((l: string) => `> ${l}`).join('\n') + '\n\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n');
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');
  // Decode entities
  text = text.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
  // Normalize whitespace
  text = text.replace(/\n{3,}/g, '\n\n').trim();

  md += text;
  if (sourceUrl) md += `\n\n---\n**原文链接：** ${sourceUrl}`;
  md += `\n\n---\n*Powered by [ReadGZH](https://readgzh.site) · [开发者文档](https://readgzh.site/docs) · [升级套餐](https://readgzh.site/pricing)*`;
  md += `\n\n💡 免费注册获取每天 30 积分 · Lite ¥9/月 · Pro ¥39/月 → [readgzh.site/dashboard](https://readgzh.site/dashboard)`;
  return md;
}

async function handleReadMode(slug: string | null, articleId: string | null, partNum?: number, formatText?: boolean): Promise<Response> {
  if (!slug && !articleId) {
    return apiError({
      code: "missing_identifier",
      status: 400,
      message: "缺少文章标识。请使用 ?s={slug} 或 ?id={uuid}。",
      hint: "示例：/rd?s=AbCdEf123 或 /rd?id=550e8400-...。完整参数说明见开发者文档。",
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let query = supabase.from("articles").select("id, title, author, content, raw_html, source_url, publish_time, created_at, view_count, slug, summary");
  if (slug) {
    query = query.eq("slug", `s/${slug}`);
  } else if (articleId) {
    query = query.eq("id", articleId);
  }

  const { data: article, error } = await query.single();

  if (error || !article) {
    console.error("Article not found:", error);
    return apiError({
      code: "article_not_found",
      status: 404,
      message: "未找到该文章。它可能尚未被收录，或链接已失效。",
      hint: "若是新文章，请先用 ?url={微信文章链接} 提交抓取；若链接错误，请到首页粘贴公众号文章 URL 重新生成。",
      extras: { slug, article_id: articleId },
    });
  }

  // Increment view count (fire and forget)
  supabase.rpc("increment_view_count", { article_id: article.id }).then(() => {});

  const publishInfo = article.publish_time ? `<p><strong>发布时间：</strong>${escapeHtml(article.publish_time)}</p>` : "";
  const sourceLink = article.source_url ? `<p><strong>原文链接：</strong><a href="${escapeHtml(article.source_url)}">${escapeHtml(article.source_url)}</a></p>` : "";

  // Prefer raw_html when available: keeps images in original position (proxied for SSR,
  // preserved as URLs for AI text/markdown). Falls back to cleaned-text content.
  const htmlWithImages: string | null = article.raw_html || null;
  let contentBody: string = htmlWithImages
    ? proxyImagesForSsr(replaceVideoIframesForSsr(htmlWithImages, article.source_url))
    : formatContentToHtml(article.content);




  // format=text: return pure Markdown (use raw_html when available so images stay in-line)
  if (formatText) {
    const sourceForMd = htmlWithImages || contentBody;
    const mdContent = htmlToMarkdown(sourceForMd, article.title, article.author || '未知作者', article.publish_time, article.source_url);
    const mdParts = splitIntoParts(mdContent);
    const totalParts = mdParts.length;
    const currentPart = partNum && partNum >= 1 && partNum <= totalParts ? partNum : 1;
    let body = mdParts[currentPart - 1];
    if (totalParts > 1) {
      body = `> 📄 第 ${currentPart} / ${totalParts} 部分\n\n` + body;
    }
    return new Response(body, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
        ...(totalParts > 1 ? { "X-Total-Parts": String(totalParts), "X-Current-Part": String(currentPart) } : {}),
      },
    });
  }

  // Handle ?part=N pagination for long articles
  const parts = splitIntoParts(contentBody);
  const totalParts = parts.length;
  const requestedPart = partNum && partNum >= 1 && partNum <= totalParts ? partNum : undefined;

  // If article has multiple parts, add pagination info
  let paginationMeta = "";
  let paginationFooter = "";
  if (totalParts > 1) {
    const currentPart = requestedPart || 1;
    const slugPath = article.slug?.replace(/^s\//, "") || "";
    const baseParam = slugPath ? `s=${slugPath}` : `id=${article.id}`;
    
    paginationMeta = `<meta name="x-total-parts" content="${totalParts}"><meta name="x-current-part" content="${currentPart}">`;
    
    const navLinks: string[] = [];
    if (currentPart > 1) {
      navLinks.push(`<a href="?${baseParam}&part=${currentPart - 1}">← 上一部分</a>`);
    }
    if (currentPart < totalParts) {
      navLinks.push(`<a href="?${baseParam}&part=${currentPart + 1}">下一部分 →</a>`);
    }
    paginationFooter = `<div style="margin:2em 0;padding:1em;background:#f5f5f5;border-radius:8px;text-align:center;">
      <p>📄 第 ${currentPart} / ${totalParts} 部分 (每部分约 40KB)</p>
      <p>${navLinks.join(" | ")}</p>
    </div>`;
    
    // Only show requested part
    contentBody = parts[(requestedPart || 1) - 1];
  }

  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(article.title)}</title>
  <meta name="description" content="${escapeHtml(article.content.substring(0, 160))}">
  <meta name="author" content="${escapeHtml(article.author || '公众号文章')}">
  <meta property="og:title" content="${escapeHtml(article.title)}">
  <meta property="og:description" content="${escapeHtml(article.content.substring(0, 200))}">
  <meta property="og:type" content="article">
  ${paginationMeta}
  <style>
    body { max-width: 800px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.8; color: #333; }
    h1 { font-size: 1.8em; margin-bottom: 0.5em; }
    .meta { color: #666; margin-bottom: 2em; border-bottom: 1px solid #eee; padding-bottom: 1em; }
    .meta p { margin: 0.3em 0; }
    .content { font-size: 1.05em; }
    .content img { max-width: 100%; height: auto; }
    .footer { margin-top: 3em; padding-top: 1em; border-top: 1px solid #eee; color: #999; font-size: 0.9em; }
    a { color: #1a73e8; }
  </style>
</head>
<body>
  <article>
    <h1>${escapeHtml(article.title)}</h1>
    <div class="meta">
      <p><strong>作者：</strong>${escapeHtml(article.author || '未知作者')}</p>
      ${publishInfo}
    </div>
    <div class="content">
      ${contentBody}
    </div>
    ${paginationFooter}
    <div class="footer" style="margin-top:3em;padding-top:1em;border-top:1px solid #eee;color:#aaa;font-size:0.85em;">
      ${sourceLink}
      <p style="margin-top:0.8em;">Powered by <a href="https://readgzh.site" style="color:#aaa;text-decoration:none;">ReadGZH</a> · <a href="https://readgzh.site/docs" style="color:#aaa;text-decoration:none;">开发者文档</a> · <a href="https://readgzh.site/pricing" style="color:#aaa;text-decoration:none;">升级套餐</a></p>
      <p style="margin-top:0.4em;font-size:0.8em;">💡 免费注册获取每天 30 积分 · Lite ¥9/月 · Pro ¥39/月 → <a href="https://readgzh.site/dashboard" style="color:#aaa;">readgzh.site/dashboard</a></p>
    </div>
  </article>
</body>
</html>`;

  return new Response(html, {
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
      ...(totalParts > 1 ? {
        "X-Total-Parts": String(totalParts),
        "X-Current-Part": String(requestedPart || 1),
      } : {}),
    },
  });
}

// ===== Rate Limiting =====
function getClientIp(req: Request): string {
  // Check common proxy headers
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

const DAILY_LIMIT = 10; // 10 credits/IP/day for anonymous users (approx 3 articles at 3 credits each)
const READ_MODE_DAILY_LIMIT = 50; // Daily limit for anonymous read mode requests
const READ_MODE_API_KEY_LIMIT = 500; // Daily limit for API Key read mode requests

// Rate limit specifically for read mode (cached article reads)
// This protects Cloud Network Egress from being exhausted by unlimited reads
async function checkReadModeRateLimit(req: Request): Promise<{ allowed: boolean; current: number; remaining: number; limit: number }> {
  // Check if request has an API Key — higher limit but still capped
  const apiKeyResult = await checkApiKeyAuth(req, 0); // 0 cost, don't deduct credits for reads
  const limit = apiKeyResult?.isApiKey ? READ_MODE_API_KEY_LIMIT : READ_MODE_DAILY_LIMIT;

  const ip = getClientIp(req);
  if (ip === "unknown") return { allowed: true, current: 0, remaining: limit, limit };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    // Use a distinct IP prefix to separate read-mode counts from scrape counts
    const readIp = `read:${ip}`;
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_ip: readIp,
      p_daily_limit: limit,
    });
    if (error) {
      console.error("Read mode rate limit error:", error);
      return { allowed: true, current: 0, remaining: limit, limit };
    }
    const result = data as { allowed: boolean; current: number; remaining: number };
    return { ...result, limit };
  } catch (err) {
    console.error("Read mode rate limit error:", err);
    return { allowed: true, current: 0, remaining: limit, limit };
  }
}

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function checkApiKeyAuth(req: Request, creditCost: number = 1): Promise<{
  isApiKey: boolean;
  allowed: boolean;
  current: number;
  remaining: number;
  limit: number;
  tier?: string;
  keyHash?: string;
  creditCost?: number;
} | null> {
  // API keys must be sent via Authorization header only.
  // Query-parameter keys (?key=sk_live_...) are no longer accepted because they leak
  // into server logs, proxy access logs, browser history and Referer headers.
  let apiKey = "";
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer sk_live_")) {
    apiKey = authHeader.replace("Bearer ", "");
  }
  if (!apiKey) return null;
  const keyHash = await hashApiKey(apiKey);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase.rpc("validate_api_key", { p_key_hash: keyHash, p_credit_cost: creditCost });
    if (error) {
      console.error("API key validation error:", error);
      return { isApiKey: true, allowed: false, current: 0, remaining: 0, limit: 0 };
    }
    const result = data as { valid: boolean; allowed: boolean; current: number; limit: number; remaining: number; tier?: string; credit_cost?: number };
    if (!result.valid) {
      return { isApiKey: true, allowed: false, current: 0, remaining: 0, limit: 0 };
    }
    return {
      isApiKey: true,
      allowed: result.allowed,
      current: result.current,
      remaining: result.remaining,
      limit: result.limit,
      tier: result.tier,
      keyHash,
      creditCost,
    };
  } catch (err) {
    console.error("API key auth error:", err);
    return { isApiKey: true, allowed: false, current: 0, remaining: 0, limit: 0 };
  }
}

// Unified credit cost: all articles cost 3 credits
function calculateCreditCost(_contentHtml: string, _isPicture: boolean): number {
  return 3;
}

// Deduct extra credits after scrape (initial validation deducted 3, no extra needed now)
async function deductExtraCredit(_keyHash: string): Promise<void> {
  // No-op: unified 3-credit cost is fully deducted during initial validation
}

async function checkRateLimit(req: Request): Promise<{ allowed: boolean; current: number; remaining: number; limit: number; isApiKey?: boolean; tier?: string; keyHash?: string } | null> {
  const apiKeyResult = await checkApiKeyAuth(req, 3); // unified 3-credit cost
  if (apiKeyResult) {
    console.log("API Key auth result:", JSON.stringify({ allowed: apiKeyResult.allowed, current: apiKeyResult.current, remaining: apiKeyResult.remaining, tier: apiKeyResult.tier, hasKeyHash: !!apiKeyResult.keyHash }));
    return apiKeyResult;
  }
  console.log("No API Key detected, falling back to IP rate limiting");

  const ip = getClientIp(req);
  if (ip === "unknown") return { allowed: true, current: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_ip: ip,
      p_daily_limit: DAILY_LIMIT,
    });
    if (error) {
      console.error("Rate limit check error:", error);
      return { allowed: true, current: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
    }
    const result = data as { allowed: boolean; current: number; remaining: number };
    return { ...result, limit: DAILY_LIMIT };
  } catch (err) {
    console.error("Rate limit error:", err);
    return { allowed: true, current: 0, remaining: DAILY_LIMIT, limit: DAILY_LIMIT };
  }
}

function rateLimitResponse(rateInfo: { current: number; remaining: number; limit?: number; isApiKey?: boolean }): Response {
  const limit = rateInfo.limit || DAILY_LIMIT;
  const isCreditsExhausted = rateInfo.isApiKey;
  const statusCode = isCreditsExhausted ? 402 : 429;
  const errorCode = isCreditsExhausted ? "insufficient_credits" : "rate_limit_exceeded";
  const errorMsg = isCreditsExhausted
    ? `API Key 积分已用完（已使用 ${rateInfo.current}/${limit} 积分）`
    : `未授权请求已达每日上限（${DAILY_LIMIT} 积分/天）。注册免费获取每天 30 积分。`;
  const hint = isCreditsExhausted
    ? "本月账号额度已用完。可购买加量包继续使用（Pro ¥9/500积分，Free ¥15/500积分，可一次购买多份）→ readgzh.site/dashboard"
    : "立即注册：readgzh.site/dashboard — 免费创建 API Key，每日 30 积分，告别 IP 限制。如果你来自 Replit / Vercel / Cloudflare Workers 等共享出口 IP，该 IP 的额度可能已被其他用户用完，请务必带上 API Key (Authorization: Bearer sk_live_...) 调用。";

  return new Response(
    JSON.stringify({
      success: false,
      error: errorCode,
      message: errorMsg,
      hint,
      current: rateInfo.current,
      limit,
      upgrade_hint: "📈 升级套餐获取更多积分：Lite ¥9/月(300积分) | Pro ¥39/月(2000积分)",
      pricing_url: "https://readgzh.site/pricing",
      purchase_url: "https://readgzh.site/dashboard?action=buy_credits",
      dashboard_url: "https://readgzh.site/dashboard",
      powered_by: "ReadGZH (https://readgzh.site) - 让 AI 读懂微信公众号",
    }),
    {
      status: statusCode,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(limit),
        "X-RateLimit-Remaining": String(rateInfo.remaining),
        ...(statusCode === 429 ? { "Retry-After": "86400" } : {}),
      },
    }
  );
}

// ===== Summary Mode: AI-generated structured summary =====
async function generateSummary(content: string, title: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    throw new Error("AI summary service not configured");
  }

  // Truncate content to ~8000 chars to keep input tokens reasonable
  const truncatedContent = content.substring(0, 8000);

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `你是一个专业的中文内容摘要助手。请为给定的微信公众号文章生成一个结构化摘要。

要求：
1. 总字数控制在 300-500 字
2. 使用以下结构：
   - 📌 核心观点（1-2句话概括文章主旨）
   - 📋 关键要点（3-5个要点，每个1-2句话）
   - 🏷️ 标签（3-5个关键词标签）
3. 语言简洁、信息密度高
4. 保留原文的关键数据和事实
5. 不要添加原文没有的信息`,
        },
        {
          role: "user",
          content: `请为以下文章生成结构化摘要：\n\n标题：${title}\n\n正文：\n${truncatedContent}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("AI summary error:", response.status, errText);
    if (response.status === 429) throw new Error("AI service rate limited, please try later");
    if (response.status === 402) throw new Error("AI service quota exceeded");
    throw new Error("Failed to generate summary");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "摘要生成失败";
}

async function handleSummaryMode(slug: string | null, articleId: string | null): Promise<Response> {
  if (!slug && !articleId) {
    return apiError({
      code: "missing_identifier",
      status: 400,
      message: "摘要接口缺少文章标识。请使用 ?s={slug}&mode=summary 或 ?id={uuid}&mode=summary。",
      hint: "AI 摘要为 Pro 专属功能，请确保已在 Authorization 头携带 sk_live_... 形式的 Pro Key。",
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let query = supabase.from("articles").select("id, title, author, content, slug, publish_time, summary, view_count");
  if (slug) {
    query = query.eq("slug", `s/${slug}`);
  } else if (articleId) {
    query = query.eq("id", articleId);
  }

  const { data: article, error } = await query.single();

  if (error || !article) {
    return apiError({
      code: "article_not_found",
      status: 404,
      message: "未找到该文章，无法生成摘要。",
      hint: "请先用 /rd?url={微信文章链接} 抓取并入库，再调用摘要接口。",
      extras: { slug, article_id: articleId },
    });
  }

  // Increment view count
  supabase.rpc("increment_view_count", { article_id: article.id }).then(() => {});

  // Use cached summary if available
  let summary = article.summary;
  if (!summary) {
    try {
      summary = await generateSummary(article.content, article.title);
      // Cache the summary for future requests (fire and forget)
      supabase.from("articles").update({ summary }).eq("id", article.id).then(() => {});
    } catch (err) {
      console.error("Summary generation failed:", err);
      return apiError({
        code: "summary_generation_failed",
        status: 500,
        message: "AI 摘要生成失败：" + (err instanceof Error ? err.message : "未知错误"),
        hint: "请稍后重试。若持续失败，可在反馈渠道告知文章 slug，我们会人工排查。",
        extras: { article_id: article.id, slug: article.slug },
      });
    }
  }

  // Calculate content parts info
  const contentLength = article.content?.length || 0;
  const totalParts = Math.ceil(contentLength / PART_SIZE) || 1;
  const slugPath = article.slug?.replace(/^s\//, "") || "";
  const contentUrl = slugPath
    ? `https://readgzh.site/${slugPath}`
    : `https://api.readgzh.site/rd?id=${article.id}`;

  return new Response(
    JSON.stringify({
      success: true,
      title: article.title,
      author: article.author,
      publish_time: article.publish_time,
      summary,
      content_url: contentUrl,
      total_parts: totalParts,
      content_length: contentLength,
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}

// ===== Main Handler =====
console.log("wechat-reader function loaded");
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // GET and HEAD requests: check if this is a "read mode" request (?s= or ?id=)
    if (req.method === "GET" || req.method === "HEAD") {
      const params = new URL(req.url).searchParams;
      const slug = params.get("s");
      const articleId = params.get("id");

      // Read mode (serving cached articles) - rate limited to protect Cloud Network Egress
      if (slug || articleId) {
        // Check read mode rate limit FIRST
        const readRateInfo = await checkReadModeRateLimit(req);
        if (!readRateInfo.allowed) {
          console.log("Read mode rate limit exceeded:", JSON.stringify(readRateInfo));
          return new Response(
            JSON.stringify({
              success: false,
              error: "read_rate_limit_exceeded",
              message: `缓存文章读取已达每日上限（${readRateInfo.limit} 次）。如需更多读取，请使用 API Key。`,
              hint: "注册免费获取更高读取限额：readgzh.site/dashboard。如果你来自 Replit / Vercel / Cloudflare Workers 等共享出口 IP，该 IP 的额度可能已被其他用户用完，请务必带上 API Key (Authorization: Bearer sk_live_...) 调用。",
              current: readRateInfo.current,
              limit: readRateInfo.limit,
              dashboard_url: "https://readgzh.site/dashboard",
            }),
            {
              status: 429,
              headers: {
                ...corsHeaders,
                "Content-Type": "application/json",
                "X-RateLimit-Limit": String(readRateInfo.limit),
                "X-RateLimit-Remaining": "0",
                "Retry-After": "86400",
              },
            }
          );
        }
        const mode = params.get("mode");
        
      // Summary mode: return AI-generated summary as JSON (Pro only)
        if (mode === "summary") {
          console.log("Summary mode: slug=", slug, "id=", articleId);
          
          // Check API Key auth and require Pro tier
          const apiAuth = await checkApiKeyAuth(req, 0); // 0 cost for summary (it's a Pro feature, not credit-based)
          if (!apiAuth || !apiAuth.isApiKey) {
            return new Response(
              JSON.stringify({
                success: false,
                error: "api_key_required",
                message: "摘要功能需要 API Key，请在请求头中添加 Authorization: Bearer sk_live_...",
                dashboard_url: "https://readgzh.site/dashboard",
              }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          if (apiAuth.tier !== "pro" && apiAuth.tier !== "pro_lifetime") {
            // Stripe Pro sync fallback: check if user actually paid but tier not yet synced
            console.log("Tier is not pro, checking Stripe for recent payment...");
            let stripeUpgraded = false;
            try {
              const supabaseService = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
              // Get user_id from api_keys via keyHash
              const { data: keyData } = await supabaseService.from("api_keys").select("user_id").eq("key_hash", apiAuth.keyHash!).single();
              if (keyData) {
                const { data: profile } = await supabaseService.from("profiles").select("email").eq("id", keyData.user_id).single();
                if (profile?.email) {
                  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
                  const customers = await stripe.customers.list({ email: profile.email, limit: 1 });
                  if (customers.data.length > 0) {
                    const sessions = await stripe.checkout.sessions.list({ customer: customers.data[0].id, limit: 20 });
                    const hasPro = sessions.data.some(s => s.payment_status === "paid" && s.status === "complete" && (!s.metadata?.type || s.metadata?.type === "pro"));
                    if (hasPro) {
                      // Upgrade all user's keys
                      await supabaseService.from("api_keys").update({ tier: "pro", daily_limit: 2000 }).eq("user_id", keyData.user_id).eq("is_active", true).eq("tier", "free");
                      stripeUpgraded = true;
                      console.log("Stripe fallback: upgraded user to Pro", keyData.user_id);
                    }
                  }
                }
              }
            } catch (e) {
              console.error("Stripe fallback check error:", e);
            }
            if (!stripeUpgraded) {
              return new Response(
                JSON.stringify({
                  success: false,
                  error: "pro_required",
                  message: "AI 智能摘要是 Pro 专属功能，请升级到 Pro 套餐",
                  pricing_url: "https://readgzh.site/pricing",
                  dashboard_url: "https://readgzh.site/dashboard",
                }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
          
          return await handleSummaryMode(slug, articleId);
        }
        
        const partParam = params.get("part");
        const partNum = partParam ? parseInt(partParam, 10) : undefined;
        const formatText = params.get("format") === "text";
        console.log("Read mode: slug=", slug, "id=", articleId, "part=", partNum, "format=", formatText ? "text" : "html");
        const response = await handleReadMode(slug, articleId, partNum, formatText);
        // For HEAD requests, return headers only (no body)
        if (req.method === "HEAD") {
          return new Response(null, { status: response.status, headers: response.headers });
        }
        return response;
      }

      // Scrape request with ?url= - rate limit applies (GET only, not HEAD)
      if (req.method === "HEAD") {
        return new Response(null, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const url = params.get("url");
      if (!url) {
        return apiError({
          code: "missing_url",
          status: 400,
          message: "请提供微信文章链接（参数 url）。",
          hint: "示例：/rd?url=https://mp.weixin.qq.com/s/AbCdEf123。仅支持 mp.weixin.qq.com / weixin.qq.com 域名。",
        });
      }

      // Check cache FIRST before deducting credits
      if (isWeixinUrl(url)) {
        const cacheSupabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        let cacheSlug: string | null = null;
        const cacheSlugMatch = url.match(/\/(s\/[^?#]+)/);
        if (cacheSlugMatch) cacheSlug = cacheSlugMatch[1];

        let existing = null;
        if (cacheSlug) {
          const { data } = await cacheSupabase.from("articles").select("id, slug").eq("slug", cacheSlug).maybeSingle();
          existing = data;
        }
        if (!existing) {
          const { data } = await cacheSupabase.from("articles").select("id, slug").eq("source_url", url).maybeSingle();
          existing = data;
        }

        if (existing) {
          console.log("Cache hit (no credit deducted):", existing.id);
          // Record cache hit for API key users (no credit cost)
          const apiAuth = await checkApiKeyAuth(req, 0);
          if (apiAuth?.keyHash) {
            const supabase2 = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
            await supabase2.rpc("record_cache_hit", { p_key_hash: apiAuth.keyHash });
          }
          const slugId = existing.slug?.replace(/^s\//, "") || "";
          const response = await handleReadMode(slugId || null, slugId ? null : existing.id);
          // Add cache headers
          const headers = new Headers(response.headers);
          headers.set("X-Cache", "HIT");
          headers.set("X-Credit-Cost", "0");
          return new Response(response.body, { status: response.status, headers });
        }
      }

      // Not cached – check rate limit (deducts 3 credits for API key users)
      const rateInfo = await checkRateLimit(req);
      if (rateInfo && !rateInfo.allowed) {
        return rateLimitResponse(rateInfo);
      }

      return await handleScrapeAndRedirect(url, rateInfo?.keyHash);
    }

    // POST request: scrape or submit article
    if (req.method === "POST") {
      const body = await req.json();

      // Handle direct article submission (from bookmarklet) - rate limit applies
      if (body.action === "submit") {
        const rateInfo = await checkRateLimit(req);
        if (rateInfo && !rateInfo.allowed) {
          return rateLimitResponse(rateInfo);
        }
        return await handleDirectSubmit(body);
      }

      // Handle URL scraping - rate limit applies
      const url = body.url;
      if (!url) {
        return apiError({
          code: "missing_url",
          status: 400,
          message: "请提供微信文章链接（请求体字段 url）。",
          hint: 'POST 示例：{"url":"https://mp.weixin.qq.com/s/..."}，Content-Type: application/json。',
        });
      }

      // Check rate limit
      const rateInfo = await checkRateLimit(req);
      if (rateInfo && !rateInfo.allowed) {
        return rateLimitResponse(rateInfo);
      }

      return await handleScrape(url, rateInfo?.keyHash);
    }

    return apiError({
      code: "method_not_allowed",
      status: 405,
      message: "不支持的 HTTP 方法。仅接受 GET（?url=... / ?s=... / ?id=...）或 POST（JSON body）。",
      hint: "完整接口规范见 https://readgzh.site/docs。OPTIONS 用于 CORS preflight。",
    });
  } catch (error) {
    console.error("Error:", error);
    return apiError({
      code: "internal_error",
      status: 500,
      message: "服务端处理请求时发生异常，请稍后重试。",
      hint: "若持续出现，请在反馈渠道附上请求时间与 URL，我们会人工排查。",
    });
  }
});

// Hostname allowlist check (replaces substring .includes which is bypassable
// via crafted URLs like https://attacker.com/?ref=mp.weixin.qq.com).
function isWeixinUrl(rawUrl: string): boolean {
  try {
    const { hostname } = new URL(rawUrl);
    return hostname === "mp.weixin.qq.com" || hostname === "weixin.qq.com";
  } catch {
    return false;
  }
}

// ===== Handle direct article submission (from bookmarklet) =====
async function handleDirectSubmit(body: Record<string, unknown>): Promise<Response> {
  const title = typeof body.title === "string" ? body.title.trim().substring(0, 500) : "";
  const content = typeof body.content === "string" ? body.content.trim().substring(0, 500000) : "";
  const author = typeof body.author === "string" ? body.author.trim().substring(0, 100) : "未知作者";
  const sourceUrl = typeof body.sourceUrl === "string" ? body.sourceUrl.trim().substring(0, 2000) : null;
  const publishTime = typeof body.publishTime === "string" ? body.publishTime.trim().substring(0, 100) : null;

  // Validate required fields
  if (!title || title.length < 1) {
    return new Response(
      JSON.stringify({ success: false, error: "文章标题不能为空" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  if (!content || content.length < 10) {
    return new Response(
      JSON.stringify({ success: false, error: "文章内容过短或为空" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Validate sourceUrl format if provided
  if (sourceUrl && !sourceUrl.startsWith("http")) {
    return new Response(
      JSON.stringify({ success: false, error: "无效的来源链接" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Extract slug from source URL
  let slug: string | null = null;
  if (sourceUrl) {
    const slugMatch = sourceUrl.match(/\/(s\/[^?#]+)/);
    if (slugMatch) slug = slugMatch[1];
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Check for duplicate by source URL or slug
  if (sourceUrl || slug) {
    let existing = null;
    if (slug) {
      const { data } = await supabase.from("articles").select("id").eq("slug", slug).maybeSingle();
      existing = data;
    }
    if (!existing && sourceUrl) {
      const { data } = await supabase.from("articles").select("id").eq("source_url", sourceUrl).maybeSingle();
      existing = data;
    }
    if (existing) {
      return new Response(
        JSON.stringify({ success: true, cached: true, articleId: existing.id }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  }

  const { data: saved, error: dbError } = await supabase
    .from("articles")
    .insert({
      title,
      author: author || "未知作者",
      content,
      source_url: sourceUrl,
      publish_time: publishTime,
      slug,
    })
    .select("id")
    .single();

  if (dbError) {
    console.error("DB error:", dbError);
    return new Response(
      JSON.stringify({ success: false, error: "保存文章失败，请稍后重试" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({ success: true, cached: false, articleId: saved.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// GET ?url= handler: scrape, store, then return SSR HTML directly (no redirect)
async function handleScrapeAndRedirect(url: string, keyHash?: string): Promise<Response> {
  if (!isWeixinUrl(url)) {
    return new Response(
      `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>链接无效 - ReadGZH</title></head><body style="font-family:system-ui;max-width:560px;margin:60px auto;padding:0 20px;color:#172533"><h1>链接无效</h1><p>请提供有效的微信公众号文章链接（域名需为 <code>mp.weixin.qq.com</code> 或 <code>weixin.qq.com</code>）。</p><p>示例：<code>https://mp.weixin.qq.com/s/AbCdEf123</code></p><p><a href="https://readgzh.site" style="color:#299e7a">回到首页粘贴链接</a> · <a href="https://readgzh.site/docs" style="color:#299e7a">查看 API 文档</a></p></body></html>`,
      { status: 400, headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" } }
    );
  }

  // First try cache
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let slug: string | null = null;
  const slugMatch = url.match(/\/(s\/[^?#]+)/);
  if (slugMatch) slug = slugMatch[1];

  let existing = null;
  if (slug) {
    const { data } = await supabase.from("articles").select("id, slug").eq("slug", slug).maybeSingle();
    existing = data;
  }
  if (!existing) {
    const { data } = await supabase.from("articles").select("id, slug").eq("source_url", url).maybeSingle();
    existing = data;
  }

  if (existing) {
    // Already cached – return SSR HTML directly
    const slugId = existing.slug?.replace(/^s\//, "") || "";
    return await handleReadMode(slugId || null, slugId ? null : existing.id);
  }

  // Not cached – scrape via handleScrape (which stores it), then return HTML
  const scrapeResult = await handleScrape(url, keyHash);
  const resultData = await scrapeResult.json();

  if (!resultData.success) {
    return apiError({
      code: "scrape_failed",
      status: 502,
      message: "抓取失败：" + (resultData.error || "未知错误"),
      hint: "请稍后重试。若该链接长期失败，可在微信内打开文章，使用首页推荐的「书签提取工具」手动提交。",
      extras: { source_url: url, upstream_error: resultData.error },
    });
  }

  // Return SSR HTML directly (no redirect)
  const savedSlug = resultData.slug?.replace(/^s\//, "") || "";
  return await handleReadMode(savedSlug || null, savedSlug ? null : resultData.articleId);
}

async function handleScrape(url: string, keyHash?: string): Promise<Response> {
    if (!isWeixinUrl(url)) {
      return apiError({
        code: "invalid_url",
        status: 400,
        message: "请提供有效的微信公众号文章链接（域名需为 mp.weixin.qq.com 或 weixin.qq.com）。",
        hint: "示例：https://mp.weixin.qq.com/s/AbCdEf123。其他平台链接暂不支持。",
        extras: { received: url },
      });
    }

    // Extract slug from URL (e.g., "s/L3Tbd4KMmPnahnStnunTVA" from WeChat URL)
    let slug: string | null = null;
    const slugMatch = url.match(/\/(s\/[^?#]+)/);
    if (slugMatch) {
      slug = slugMatch[1];
    }

    // Check cache by slug first, then by URL
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let existing = null;
    if (slug) {
      const { data } = await supabase
        .from("articles")
        .select("id, slug")
        .eq("slug", slug)
        .maybeSingle();
      existing = data;
    }
    if (!existing) {
      const { data } = await supabase
        .from("articles")
        .select("id, slug")
        .eq("source_url", url)
        .maybeSingle();
      existing = data;
    }

    if (existing) {
      console.log("Cache hit:", existing.id);
      return new Response(
        JSON.stringify({ success: true, cached: true, articleId: existing.id, slug: existing.slug }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Minimum content length to consider extraction successful
    const MIN_CONTENT_LENGTH = 100;

    // Try scraping methods
    let html = await tryDirectFetch(url);

    if (!html || html.length < 500) {
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        const fc = await tryFirecrawl(url, firecrawlKey);
        html = fc.html;
      }
    }

    if (!html || html.length < 500) {
      return apiError({
        code: "upstream_empty",
        status: 502,
        message: "无法获取文章内容（上游返回为空或过短）。",
        hint: "请稍后重试。若链接复制自分享卡片，建议在微信里重新打开后再复制完整链接。",
        extras: { source_url: url },
      });
    }

    // Check if WeChat returned an error page (deleted/invalid article)
    const wechatError = isWeChatErrorPage(html);
    if (wechatError) {
      console.log("WeChat error page detected:", wechatError);
      return apiError({
        code: "wechat_article_unavailable",
        status: 404,
        message: wechatError,
        hint: "该文章已被微信侧删除或屏蔽，无法再抓取。可在我们站内搜索是否已有早先版本的缓存。",
        extras: { source_url: url },
      });
    }

    // Check for verification page
    if (isVerificationPage(html)) {
      // Try Firecrawl as fallback for verification pages
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        console.log("Verification page detected, trying Firecrawl fallback");
        const fc = await tryFirecrawl(url, firecrawlKey);
        const firecrawlHtml = fc.html;
        if (firecrawlHtml && firecrawlHtml.length > 500 && !isVerificationPage(firecrawlHtml)) {
          html = firecrawlHtml;
        } else {
          return wechatVerificationError(url);
        }
      } else {
        return wechatVerificationError(url);
      }
    }

    // Helper: attempt content extraction from a given HTML string
    function tryExtractContent(srcHtml: string): { metadata: ReturnType<typeof extractMetadata>; contentHtml: string; textContent: string; isPictureWithImages: boolean } {
      const meta = extractMetadata(srcHtml);
      // Try picture template first (小绿书 format)
      const pictureData = extractPictureTemplate(srcHtml);
      if (pictureData) {
        console.log("Detected picture template (小绿书), images:", pictureData.images.length);
        if (meta.title === "无标题") {
          const doc = new DOMParser().parseFromString(srcHtml, "text/html");
          const ogTitle = doc?.querySelector('meta[property="og:title"]');
          if (ogTitle) meta.title = (ogTitle as Element).getAttribute("content") || "无标题";
        }
        return { metadata: meta, contentHtml: pictureData.contentHtml, textContent: pictureData.textContent || meta.title, isPictureWithImages: pictureData.images.length > 0 };
      }
      // Short text template (公众号短文/动态, item_show_type = 10/17) — content lives in inline JS data
      const shortText = extractShortTextTemplate(srcHtml);
      if (shortText) {
        console.log("Detected short-text template, text length:", shortText.textContent.length, "images:", shortText.images.length);
        if (shortText.title && (meta.title === "无标题" || meta.title === shortText.author)) {
          meta.title = shortText.title;
        }
        if (shortText.author && meta.author === "公众号文章") {
          meta.author = shortText.author;
        }
        // Treat as "has content" so downstream doesn't trigger Firecrawl fallback
        return { metadata: meta, contentHtml: shortText.contentHtml, textContent: shortText.textContent, isPictureWithImages: shortText.images.length > 0 };
      }
      // Standard article extraction
      const extracted = extractFormattedContent(srcHtml);
      return { metadata: meta, contentHtml: extracted.contentHtml, textContent: extracted.textContent, isPictureWithImages: false };
    }

    // First extraction attempt
    let result = tryExtractContent(html);

    // If content is too short (and not a picture template with images), try Firecrawl fallback
    if (!result.isPictureWithImages && (!result.textContent || result.textContent.length < MIN_CONTENT_LENGTH)) {
      console.log(`Content too short (${result.textContent?.length || 0} chars), trying Firecrawl fallback`);
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      if (firecrawlKey) {
        const fc = await tryFirecrawl(url, firecrawlKey);
        // Try HTML extraction first
        if (fc.html && fc.html.length > 500 && !isVerificationPage(fc.html)) {
          const firecrawlResult = tryExtractContent(fc.html);
          if (firecrawlResult.textContent && firecrawlResult.textContent.length > (result.textContent?.length || 0) && !isVerificationPage(firecrawlResult.textContent)) {
            console.log(`Firecrawl HTML got better content: ${firecrawlResult.textContent.length} chars`);
            result = firecrawlResult;
            html = fc.html;
          }
        }
        // If HTML extraction still failed, use markdown directly as content
        if ((!result.textContent || result.textContent.length < MIN_CONTENT_LENGTH) && fc.markdown && fc.markdown.length >= MIN_CONTENT_LENGTH) {
          // CRITICAL: check if markdown is just verification page text
          if (isVerificationPage(fc.markdown)) {
            console.log(`Firecrawl markdown is verification page text (${fc.markdown.length} chars), rejecting`);
          } else {
            console.log(`Using Firecrawl markdown as content: ${fc.markdown.length} chars`);
            const meta = extractMetadata(html);
            const mdTitleMatch = fc.markdown.match(/^#\s+(.+)/m);
            if (mdTitleMatch && meta.title === "无标题") {
              meta.title = mdTitleMatch[1].trim();
            }
            result = {
              metadata: meta,
              contentHtml: fc.markdown.split("\n").filter(l => l.trim()).map(l => `<p>${l}</p>`).join("\n"),
              textContent: fc.markdown,
            };
          }
        }
      }
    }

    const { metadata, contentHtml, textContent } = result;

    // Final safety: reject if extracted content is actually a verification page
    if (isVerificationPage(textContent || "")) {
      console.log("Post-extraction verification check failed: content is verification page text");
      return wechatVerificationError(url);
    }

    // Validate: strip noise (security tips, follow prompts) before checking length
    const substantiveText = stripNoiseText(textContent || "");
    const MIN_SUBSTANTIVE_LENGTH = 50;

    if (!result.isPictureWithImages && (!textContent || textContent.length < MIN_CONTENT_LENGTH || substantiveText.length < MIN_SUBSTANTIVE_LENGTH)) {
      console.log(`Content validation failed: raw=${textContent?.length || 0}, substantive=${substantiveText.length}`);
      return apiError({
        code: "content_too_short",
        status: 422,
        message: "无法提取文章正文内容（仅检测到安全提示或空白内容）。",
        hint: "该文章可能使用了复杂排版或正文通过 JS 动态加载。建议：在微信内打开后使用首页「书签提取工具」手动提交。",
        extras: {
          source_url: url,
          raw_length: textContent?.length || 0,
          substantive_length: substantiveText.length,
          bookmarklet_url: "https://readgzh.site/#bookmarklet",
        },
      });
    }

    // Save to database - content stores plain text for AI, raw_html stores formatted HTML for display
    const { data: saved, error: dbError } = await supabase
      .from("articles")
      .insert({
        title: metadata.title.substring(0, 500),
        author: metadata.author,
        content: textContent,
        raw_html: contentHtml.substring(0, 500000),
        source_url: url,
        publish_time: metadata.publishTime,
        slug,
      })
      .select("id, slug")
      .single();

    if (dbError) {
      console.error("DB error:", dbError);
      return apiError({
        code: "db_save_failed",
        status: 500,
        message: "保存文章失败：" + (dbError.message || "数据库异常"),
        hint: "请稍后重试。若持续出现，请在反馈渠道附上文章 URL，我们会人工排查。",
        extras: { source_url: url },
      });
    }

    console.log("Saved:", saved.id, saved.slug, metadata.title, "Text:", textContent.length, "HTML:", contentHtml.length);

    // Calculate credit cost and deduct extra if complex article
    const isPicture = isPictureTemplate(html!);
    const creditCost = calculateCreditCost(contentHtml, isPicture);
    if (creditCost > 1 && keyHash) {
      console.log(`Complex article detected (cost=${creditCost}), deducting extra credit`);
      await deductExtraCredit(keyHash);
    }

    return new Response(
      JSON.stringify({ success: true, cached: false, articleId: saved.id, slug: saved.slug, creditCost }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

