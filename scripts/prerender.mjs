import { build } from "vite";
import { resolve } from "node:path";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";

// Render public content only: importing App would initialize browser-only services.
await build({
  configFile: false,
  resolve: { alias: { "@": resolve("src") } },
  esbuild: { jsx: "automatic" },
  build: {
    ssr: "scripts/prerender.tsx",
    outDir: "dist-ssr",
    rollupOptions: { output: { entryFileNames: "prerender.mjs" } },
  },
});
const { renderPages } = await import(pathToFileURL(resolve("dist-ssr/prerender.mjs")).href);
const template = await readFile("dist/index.html", "utf8");
const llmsFullParts = [];
const pages = renderPages();
for (const page of pages) {
  const dom = new JSDOM(template);
  const document = dom.window.document;
  document
    .querySelectorAll(
      'title, meta[name="description"], meta[name="robots"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], script[type="application/ld+json"], noscript'
    )
    .forEach((node) => node.remove());
  document.head.insertAdjacentHTML("beforeend", page.head);
  document.getElementById("root").innerHTML = page.body;
  if (page.path === "/") {
    // Homepage overwrites the SPA shell; other routes fall back to it, so keep a clean copy for them.
    await writeFile(resolve("dist", "index.html"), dom.serialize());
  } else {
    const directory = resolve("dist", page.path.slice(1));
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, "index.html"), dom.serialize());
    // Static hosts also resolve extensionless /docs to /docs.html.
    await writeFile(`${directory}.html`, dom.serialize());
  }
  console.log(`Prerendered ${page.path}`);
  // Collect plain-text content for llms-full.txt (docs, guides, FAQ in one file).
  const bodyDom = new JSDOM(`<body>${page.body}</body>`);
  const text = (bodyDom.window.document.body.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  // Guides, docs, and FAQ only. noindex shells and legal/marketing pages stay out of this file.
  if (page.path.startsWith("/guides/") || page.path === "/docs" || page.path === "/faq") {
    llmsFullParts.push(`# ${page.path}\n\n${text}`);
  }
  bodyDom.window.close();
  dom.window.close();
}
await writeFile(
  resolve("dist", "llms-full.txt"),
  `# ReadGZH — Full documentation\n\n> ReadGZH 是一个把微信公众号文章转换为 AI 可读格式的 API 服务。本文件拼接了开发者文档、全部使用指南和常见问题的完整正文。\n\n${llmsFullParts.join("\n\n---\n\n")}\n`,
);
console.log("Wrote llms-full.txt");

// Keep the published sitemap aligned with prerender output.
// Indexable pages missing from public/sitemap.xml are inserted.
// Prerendered noindex pages (currently /articles) are removed.
// /s/ article URLs are never added: those copies must not be indexed.
let sitemap = await readFile(resolve("dist", "sitemap.xml"), "utf8");
for (const page of pages) {
  const loc = `https://readgzh.site${page.path === "/" ? "/" : page.path}`;
  const block = new RegExp(`\\s*<url>\\s*<loc>${loc.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}</loc>[\\s\\S]*?</url>`);
  if (page.head.includes("noindex")) {
    sitemap = sitemap.replace(block, "");
    continue;
  }
  if (sitemap.includes(`<loc>${loc}</loc>`)) continue;
  sitemap = sitemap.replace(
    "</urlset>",
    `  <url>\n    <loc>${loc}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n</urlset>`,
  );
  console.log(`Sitemap + ${loc}`);
}
if (sitemap.includes("/s/") || sitemap.includes("/articles")) {
  throw new Error("sitemap still lists /articles or an /s/ article URL");
}
await writeFile(resolve("dist", "sitemap.xml"), sitemap);
