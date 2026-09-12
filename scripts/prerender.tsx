import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider, type HelmetServerState } from "react-helmet-async";
import Guide from "../src/pages/guides/AiReadWechatPage";
import Docs from "../src/pages/DocsPage";
import FAQ from "../src/pages/FAQPage";

export function renderPages() {
  const routes: [string, React.ComponentType][] = [
    ["/guides/ai-read-wechat", Guide],
    ["/docs", Docs],
    ["/faq", FAQ],
  ];
  return routes.map(([path, Page]) => {
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
