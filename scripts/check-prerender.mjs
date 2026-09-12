import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";

const titles = new Set();
for (const [route, marker] of [
  ["guides/ai-read-wechat", "方案 A"],
  ["guides/wechat-to-markdown", "实测输出"],
  ["guides/compare-wechat-articles", "来源卡片"],
  ["docs", "API"],
  ["faq", "匿名用户每天 10 积分"],
]) {
  const dom = new JSDOM(await readFile(`dist/${route}/index.html`, "utf8"));
  assert.equal(await readFile(`dist/${route}.html`, "utf8"), await readFile(`dist/${route}/index.html`, "utf8"));
  const doc = dom.window.document;
  assert.ok(doc.querySelector("#root").textContent.includes(marker), `${route}: missing body`);
  assert.equal(doc.querySelectorAll("title").length, 1);
  assert.equal(doc.querySelectorAll('meta[name="description"]').length, 1);
  assert.equal(doc.querySelectorAll('link[rel="canonical"]').length, 1);
  assert.equal(doc.querySelector('link[rel="canonical"]').href, `https://readgzh.site/${route}`);
  assert.equal(doc.querySelector('meta[property="og:url"]').content, `https://readgzh.site/${route}`);
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
  dom.window.close();
  console.log(`PASS /${route}: unique metadata, full body, assets, FAQ answers`);
}
assert.equal(titles.size, 5);
