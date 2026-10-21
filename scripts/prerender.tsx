import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import { collectPrerenderPages, type PrerenderPage } from "../src/prerender/pages";
import Docs from "../src/pages/DocsPage";
import FAQ from "../src/pages/FAQPage";
import Home from "../src/pages/Index";
import Pricing from "../src/pages/PricingPage";
import Privacy from "../src/pages/PrivacyPage";
import Terms from "../src/pages/TermsPage";
import Cookies from "../src/pages/CookiesPage";
import Comments from "../src/pages/CommentsPage";
import Changelog from "../src/pages/ChangelogPage";
import Enterprise from "../src/pages/EnterprisePage";
import Articles from "../src/pages/ArticlesPage";

/**
 * Static HTML for clients that do not run JavaScript (GPTBot, Bingbot, …).
 *
 * Lovable hosting serves a built file when one exists
 * (`/docs` → `dist/docs/index.html` and `dist/docs.html`). Every other path,
 * including `/s/:slug`, `/a/:id`, and unknown URLs, is `dist/index.html`
 * with HTTP 200. That file is also the homepage, because `/` is `index.html`.
 * This host does not honor `_headers`, `_redirects`, or a custom 404 status,
 * and it does not let the app set `X-Robots-Tag` on HTML responses.
 *
 * Do not put `noindex` on the homepage shell. That would deindex `/`.
 * `/articles` is prerendered below so its own file carries `noindex`.
 * `/s/:slug` cannot be a file per article; non-JS HTML requests still receive
 * the homepage shell. The React page sets `noindex` for browsers and for
 * Lovable's `Accept: text/markdown` renderer. `api.readgzh.site/rd` sets
 * `X-Robots-Tag` in the edge function.
 *
 * Adding a guide:
 * 1. Add `src/pages/guides/<Name>.tsx`.
 * 2. Export `prerenderPages = [{ path: "/guides/<slug>", Component }]`.
 *    `App.tsx` registers that route from the same export. Do not add a
 *    second `<Route>` by hand.
 * 3. `npm run build` writes the HTML and, when the page is indexable,
 *    inserts the URL into `dist/sitemap.xml` if it is missing.
 * A guide that exists only as a `<Route>` stays invisible to non-JS crawlers:
 * they receive the homepage title, canonical, and body.
 */

const guideModules = import.meta.glob("../src/pages/guides/*.tsx", { eager: true }) as Record<
  string,
  { prerenderPages?: PrerenderPage[] }
>;

const staticPages: PrerenderPage[] = [
  { path: "/docs", Component: Docs },
  { path: "/faq", Component: FAQ },
  { path: "/pricing", Component: Pricing },
  { path: "/privacy", Component: Privacy },
  { path: "/terms", Component: Terms },
  { path: "/cookies", Component: Cookies },
  { path: "/comments", Component: Comments },
  { path: "/changelog", Component: Changelog },
  { path: "/enterprise", Component: Enterprise },
  // noindex shell: own title and canonical, not the homepage.
  { path: "/articles", Component: Articles },
  { path: "/", Component: Home },
];

export function renderPages() {
  const routes = [...collectPrerenderPages(guideModules), ...staticPages];
  const paths = routes.map((route) => route.path);
  const dupes = paths.filter((path, index) => paths.indexOf(path) !== index);
  if (dupes.length) throw new Error(`Duplicate prerender path: ${dupes.join(", ")}`);

  return routes.map(({ path, Component: Page }) => {
    const context = {} as { helmet: HelmetServerState };
    const body = renderToString(
      <HelmetProvider context={context}>
        <StaticRouter location={path}>
          <Page />
        </StaticRouter>
      </HelmetProvider>
    );
    const { helmet } = context;
    return {
      path,
      body,
      head: [helmet.title, helmet.meta, helmet.link, helmet.script].map((tag) => tag.toString()).join("\n"),
    };
  });
}
