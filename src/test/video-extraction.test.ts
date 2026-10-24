import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";

// Run the actual edge-function helpers without its network imports or Deno server.
const source = readFileSync("supabase/functions/wechat-reader/index.ts", "utf8");
const ast = ts.createSourceFile("reader.ts", source, ts.ScriptTarget.Latest, true);
const names = new Set([
  "isVideoOnlyArticle", "deepExtractText", "extractFormattedContent",
  "escapeHtml", "sanitizeHtmlForSsr", "replaceVideoIframesForSsr",
]);
const helpers = ast.statements.filter((node) =>
  (ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text)) ||
  (ts.isVariableStatement(node) && node.declarationList.declarations.some((decl) =>
    ts.isIdentifier(decl.name) && decl.name.text === "DANGEROUS_PAIRED_TAGS")),
).map((node) => node.getText(ast).replace(/^export /, "")).join("\n");
const js = ts.transpile(helpers, { target: ts.ScriptTarget.ES2022 });
const extract = new Function("DOMParser", `${js}; return extractFormattedContent;`)(DOMParser) as
  (html: string, url: string) => { contentHtml: string; textContent: string; isVideoOnly: boolean };
const url = "https://mp.weixin.qq.com/s/example?a=1&b=2";
const video = '<iframe class="extra video_iframe" data-mpvid="123" data-cover="https://mmbiz.qpic.cn/cover?x=1&amp;y=2" src="javascript:alert(1)" onload="alert(1)"></iframe>';
const page = (body: string) => `<div id="js_content">${body}</div>`;

describe("video extraction remains safe without losing media context", () => {
  it("keeps a safe original-article link and cover through storage and both readers", () => {
    const result = extract(page(`<p>${"文章正文".repeat(40)}</p>${video}`), url);
    const dom = new DOMParser().parseFromString(result.contentHtml, "text/html");
    expect(dom.querySelector("a")?.getAttribute("href")).toBe(url);
    expect(dom.querySelector("img")?.getAttribute("src")).toContain("image-proxy?url=");
    expect(dom.querySelector("iframe, script, [onload]")).toBeNull();
    expect(result.isVideoOnly).toBe(false);
  });

  it("recognizes video-only content before the sanitizer removes player metadata", () => {
    expect(extract(page(`<section>${" ".repeat(120)}${video}</section>`), url).isVideoOnly).toBe(true);
  });

  it("supports videos without a cover and data-mpvid-only players", () => {
    const result = extract(page('<iframe data-mpvid="123"></iframe>'), url);
    expect(result.isVideoOnly).toBe(true);
    const dom = new DOMParser().parseFromString(result.contentHtml, "text/html");
    expect(dom.querySelector("a")?.getAttribute("href")).toBe(url);
    expect(dom.querySelector("iframe")).toBeNull();
  });

  it("does not mistake an image article for video-only because of page boilerplate", () => {
    expect(extract(`${page('<img src="https://mmbiz.qpic.cn/photo">')} ${video}`, url).isVideoOnly).toBe(false);
  });

  it("still removes arbitrary iframes and unsafe attributes and links", () => {
    const result = extract(page(`${video}<iframe srcdoc="bad">bad</iframe><img src=x onerror=alert(1)><a href='javascript:alert(1)'>bad</a>`), 'javascript:alert(1)');
    const dom = new DOMParser().parseFromString(result.contentHtml, "text/html");
    expect(dom.querySelector("iframe, [onerror], [srcdoc]")).toBeNull();
    expect([...dom.querySelectorAll("a")].every((a) => a.getAttribute("href") === "#")).toBe(true);
  });
});