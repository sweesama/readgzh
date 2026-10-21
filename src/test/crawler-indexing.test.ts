import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("cached article copies stay crawlable and noindex", () => {
  it("does not disallow /s/, /articles, or /rd in robots.txt", () => {
    const robots = read("public/robots.txt");
    expect(robots).not.toMatch(/Disallow:\s*\/s\/?/i);
    expect(robots).not.toMatch(/Disallow:\s*\/a\/?/i);
    expect(robots).not.toMatch(/Disallow:\s*\/articles/i);
    expect(robots).not.toMatch(/Disallow:\s*\/rd/i);
    expect(robots).toMatch(/Allow:\s*\//);
  });

  it("keeps guides in the sitemap and omits article copies", () => {
    const sitemap = read("public/sitemap.xml");
    expect(sitemap).toContain("https://readgzh.site/guides/ai-read-wechat");
    expect(sitemap).toContain("https://readgzh.site/guides/wechat-to-markdown");
    expect(sitemap).toContain("https://readgzh.site/guides/compare-wechat-articles");
    expect(sitemap).toContain("https://readgzh.site/guides/wechat-article-notes");
    expect(sitemap).not.toContain("/articles");
    expect(sitemap).not.toContain("/s/");
  });

  it("sets X-Robots-Tag on every /rd response", () => {
    const source = read("supabase/functions/rd/index.ts");
    expect(source).toContain('headers.set("X-Robots-Tag", "noindex")');
    expect(source).not.toMatch(/mp\.weixin\.qq\.com/);
    const returns = source.match(/return new Response/g) ?? [];
    expect(returns.length).toBeGreaterThanOrEqual(4);
    expect(source).toContain("noindexHeaders");
    expect(source).toContain('responseHeaders.set("X-Robots-Tag", "noindex")');
  });

  it("marks reader HTML noindex without a cross-domain canonical", () => {
    const reader = read("supabase/functions/wechat-reader/index.ts");
    expect(reader).toContain('<meta name="robots" content="noindex, follow">');
    expect(reader).toContain('"X-Robots-Tag": "noindex"');
    expect(reader).not.toContain('rel="canonical"');
    const articlePage = read("src/pages/ArticlePage.tsx");
    expect(articlePage).toContain("noindex");
    expect(articlePage).not.toContain("canonical");
    expect(articlePage).not.toMatch(/path=\{article\.source_url/);
  });
});
