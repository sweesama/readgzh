# Project Rules

- Convert WeChat video players into inert original-article links before extraction sanitization; classify video-only bodies before conversion so security filtering cannot erase media context or bypass the existing refund path.

- Keep `.env` tracked in git (never add it to `.gitignore`) — Lovable publish builds read it from the repo; removing it caused a blank published site. It only contains public values.
- Homepage prerender overwrites dist/index.html (the SPA fallback shell); its head tags carry data-rh so Helmet replaces them on other client routes — why: "/" must ship real HTML and canonical to non-JS crawlers.
- Lovable static hosting cannot set a 404 status or `X-Robots-Tag` on HTML. Any path without its own prerendered file (`/s/:slug`, `/a/:id`, unknown URLs) is that homepage shell with HTTP 200. Do not put `noindex` on the shell — it would deindex `/`. New guides must `export const prerenderPages` from `src/pages/guides/` (see `scripts/prerender.tsx`). `/articles` is prerendered with `noindex`. Article-copy `X-Robots-Tag` lives on the `rd` edge function.
- `/rd` defaults to `format=text` (UTF-8 Markdown) for every caller; `?format=html` stays opt-in — why: the gateway serves function HTML as charset-less text/plain (mojibake in browsers, hard for AIs) and the api Worker follows redirects, so UA-based redirects to /s/:slug cannot work.
