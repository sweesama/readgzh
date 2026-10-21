import type { ComponentType } from "react";

/** A public page the build can render to static HTML. */
export type PrerenderPage = {
  path: string;
  Component: ComponentType;
};

/**
 * Collect `export const prerenderPages` from Vite `import.meta.glob` results.
 * Guide files under `src/pages/guides/` use this so a new guide is prerendered
 * and registered in the router without editing a second path list.
 */
export function collectPrerenderPages(
  modules: Record<string, { prerenderPages?: PrerenderPage[] }>,
): PrerenderPage[] {
  const pages = Object.values(modules).flatMap((mod) => mod.prerenderPages ?? []);
  const seen = new Set<string>();
  for (const page of pages) {
    if (!page.path.startsWith("/")) {
      throw new Error(`Prerender path must start with /: ${page.path}`);
    }
    if (seen.has(page.path)) {
      throw new Error(`Duplicate prerender path: ${page.path}`);
    }
    seen.add(page.path);
  }
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}
