import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { JSDOM } from "jsdom";

const INDEX_ROBOTS = "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1";
const titles = new Set();

async function readPage(route) {
  const html = await readFile(`dist/${route}/index.html`, "utf8");
  assert.equal(await readFile(`dist/${route}.html`, "utf8"), html, `${route}: .html copy differs`);
  const dom = new JSDOM(html);
  return dom;
}

function assertIndexable(route, doc, marker) {
  assert.ok(doc.querySelector("#root").textContent.includes(marker), `${route}: missing body`);
  assert.equal(doc.querySelectorAll("title").length, 1, route);
  assert.equal(doc.querySelectorAll('meta[name="description"]').length, 1, route);
  assert.equal(doc.querySelectorAll('meta[name="robots"]').length, 1, route);
  assert.equal(doc.querySelector('meta[name="robots"]').content, INDEX_ROBOTS, route);
  assert.equal(doc.querySelectorAll('link[rel="canonical"]').length, 1, route);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, `https://readgzh.site/${route}`, route);
  assert.equal(doc.querySelector('meta[property="og:url"]').content, `https://readgzh.site/${route}`, route);
  assert.ok(!doc.title.includes("让 AI 读懂微信公众号"), `${route}: still using homepage title`);
  assert.ok(doc.querySelector('script[type="module"][src^="/assets/"]'), "client bundle missing");
  assert.ok(doc.querySelector('link[rel="stylesheet"]'), "styles missing");
  for (const script of doc.querySelectorAll('script[type="application/ld+json"]')) {
    const data = JSON.parse(script.textContent);
    if (data["@type"] === "FAQPage") {
      for (const question of data.mainEntity) {
        assert.ok(doc.querySelector("#root").textContent.includes(question.acceptedAnswer.text), "FAQ answer absent from body");
      }
    }
  }
  titles.add(doc.title);
}

for (const [route, marker] of [
  ["docs", "API"],
  ["faq", "匿名用户每天 10 积分"],
  ["pricing", "每日 30 积分"],
  ["privacy", "隐私政策"],
  ["terms", "服务条款"],
  ["cookies", "Cookie 政策"],
  ["comments", "留言板"],
  ["changelog", "新鲜事"],
  ["enterprise", "对公转账"],
]) {
  const dom = await readPage(route);
  assertIndexable(route, dom.window.document, marker);
  dom.window.close();
  console.log(`PASS /${route}: own title, canonical, indexable body`);
}

const guideDirs = (await readdir("dist/guides", { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
assert.ok(guideDirs.length >= 4, "expected the existing guides to be prerendered");
for (const slug of guideDirs) {
  const route = `guides/${slug}`;
  const dom = await readPage(route);
  const doc = dom.window.document;
  assertIndexable(route, doc, "");
  assert.ok(doc.querySelector("#root").textContent.trim().length > 200, `${route}: body too short`);
  dom.window.close();
  console.log(`PASS /${route}: guide prerender`);
}

for (const file of await readdir("src/pages/guides")) {
  if (!file.endsWith(".tsx")) continue;
  const src = await readFile(`src/pages/guides/${file}`, "utf8");
  assert.match(src, /export const prerenderPages\b/, `${file}: export prerenderPages so the build picks the guide up`);
  for (const match of src.matchAll(/path:\s*"(\/guides\/[^"]+)"/g)) {
    const slug = match[1].slice("/guides/".length);
    assert.ok(guideDirs.includes(slug), `${file}: ${match[1]} was not prerendered`);
  }
}

{
  const dom = await readPage("articles");
  const doc = dom.window.document;
  assert.equal(doc.querySelectorAll("title").length, 1);
  assert.equal(doc.querySelectorAll('meta[name="robots"]').length, 1);
  assert.equal(doc.querySelector('meta[name="robots"]').content, "noindex, follow");
  assert.equal(doc.querySelector('link[rel="canonical"]').href, "https://readgzh.site/articles");
  assert.ok(doc.title.includes("文章库"), doc.title);
  assert.ok(doc.querySelector("#root").textContent.includes("文章库"));
  assert.ok(!doc.title.includes("让 AI 读懂微信公众号"));
  assert.equal(doc.querySelectorAll('link[rel="canonical"][href="https://readgzh.site/"]').length, 0);
  dom.window.close();
  console.log("PASS /articles: noindex shell, not the homepage");
}

assert.equal(titles.size, 9 + guideDirs.length);
{
  const doc = new JSDOM(await readFile("dist/index.html", "utf8")).window.document;
  assert.equal(doc.querySelectorAll('link[rel="canonical"]').length, 1);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, "https://readgzh.site/");
  assert.equal(doc.querySelectorAll('meta[name="robots"]').length, 1);
  assert.equal(doc.querySelector('meta[name="robots"]').content, INDEX_ROBOTS);
  assert.ok(!doc.querySelector('meta[name="robots"]').content.includes("noindex"));
  assert.ok(doc.querySelector("#root").textContent.includes("ReadGZH"), "home body missing");
  const types = [...doc.querySelectorAll('script[type="application/ld+json"]')].flatMap((s) => JSON.parse(s.textContent)["@graph"] || []).map((n) => n["@type"]);
  assert.ok(types.includes("WebSite") && types.includes("WebApplication"), "home schema missing");
  console.log("PASS /: canonical, index,follow, body, WebSite schema");
}

{
  const sitemap = await readFile("dist/sitemap.xml", "utf8");
  assert.ok(!sitemap.includes("/articles"), "sitemap lists /articles");
  assert.ok(!sitemap.includes("/s/"), "sitemap lists an /s/ URL");
  for (const slug of guideDirs) {
    assert.ok(sitemap.includes(`https://readgzh.site/guides/${slug}`), `sitemap missing /guides/${slug}`);
  }
  for (const path of ["/docs", "/faq", "/pricing", "/privacy", "/changelog", "/enterprise"]) {
    assert.ok(sitemap.includes(`https://readgzh.site${path}`), `sitemap missing ${path}`);
  }
  console.log("PASS sitemap: guides kept, /articles and /s/ absent");
}
