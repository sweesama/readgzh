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
for (const page of renderPages()) {
  const dom = new JSDOM(template);
  const document = dom.window.document;
  document
    .querySelectorAll(
      'title, meta[name="description"], meta[property^="og:"], meta[name^="twitter:"], link[rel="canonical"], script[type="application/ld+json"], noscript'
    )
    .forEach((node) => node.remove());
  document.head.insertAdjacentHTML("beforeend", page.head);
  document.getElementById("root").innerHTML = page.body;
  const directory = resolve("dist", page.path.slice(1));
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, "index.html"), dom.serialize());
  // Static hosts also resolve extensionless /docs to /docs.html.
  await writeFile(`${directory}.html`, dom.serialize());
  console.log(`Prerendered ${page.path}`);
  dom.window.close();
}
