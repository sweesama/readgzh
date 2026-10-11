# Project Rules

- Keep `.env` tracked in git (never add it to `.gitignore`) — Lovable publish builds read it from the repo; removing it caused a blank published site. It only contains public values.
- Homepage prerender overwrites dist/index.html (the SPA fallback shell); its head tags carry data-rh so Helmet replaces them on other client routes — why: "/" must ship real HTML and canonical to non-JS crawlers.
