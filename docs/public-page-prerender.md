# Public page HTML

`npm run build` and `npm run build:dev` render `/docs`, `/faq`, and
`/guides/ai-read-wechat` into route directories and matching `.html` files in `dist`,
covering both trailing-slash and extensionless static-host resolution. The renderer imports
the same React page components used by the browser, including their SEO metadata.
It does not import the application shell, authentication, or data-fetching routes.
FAQ sections use native HTML details/summary so their answers remain available
and expandable without JavaScript.

Run `node scripts/check-prerender.mjs` after building to verify page bodies,
canonical URLs, unique metadata, client assets, and FAQ/schema agreement.
The existing browser entry point mounts normally and preserves SPA navigation.

Hosting must serve existing `dist/<route>/index.html` files before the SPA
fallback to `dist/index.html`. Vite preview supports this; verify the production
host after publishing with ordinary HTTP requests to all three routes. A hosting
rule that rewrites every path to the root HTML would bypass these generated files.
Do not consider the production crawl issue resolved until those responses contain
the respective page body and canonical. No crawler-specific response is needed.
