// Shared homepage structured data (WebSite + Organization + WebApplication), also mirrored in index.html.
export const SITE_SCHEMA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://readgzh.site/#website",
      "name": "ReadGZH",
      "url": "https://readgzh.site",
      "inLanguage": "zh-CN",
      "publisher": {
        "@id": "https://readgzh.site/#org"
      },
      "about": {
        "@id": "https://readgzh.site/#app"
      }
    },
    {
      "@type": "Organization",
      "@id": "https://readgzh.site/#org",
      "name": "ReadGZH",
      "url": "https://readgzh.site",
      "logo": "https://readgzh.site/logo.png",
      "email": "sweeyeah@hotmail.com",
      "sameAs": [
        "https://github.com/sweesama",
        "https://clawhub.io/skills/readgzh"
      ]
    },
    {
      "@type": "WebApplication",
      "name": "ReadGZH",
      "url": "https://readgzh.site",
      "description": "ReadGZH 是一款微信公众号文章 AI 阅读工具。通过服务端代理抓取并清理文章内容，生成 AI 可直接访问的公开链接，输出比原始微信 HTML 更精简。支持 ChatGPT、Claude、DeepSeek、豆包等能访问网页的 AI 工具。",
      "applicationCategory": "UtilityApplication",
      "operatingSystem": "Web",
      "inLanguage": [
        "zh-CN",
        "en"
      ],
      "featureList": [
        "Server-side extraction pipeline for WeChat articles",
        "Strips inline styles, class and data attributes to reduce tokens",
        "CDN image proxy for article images",
        "Cross-agent shared cache (cached reads cost no credits)",
        "Image-post (小绿书) full parsing",
        "Smart chunking for long articles (40KB+ auto-split)",
        "AI-generated structured summaries (Pro)",
        "MCP Server protocol support",
        "Zero-JS SSR HTML output"
      ],
      "softwareVersion": "2.1",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "CNY",
        "description": "免费套餐：注册后每日可领取 30 积分，每篇未缓存文章 3 积分，缓存文章读取不扣积分"
      },
      "potentialAction": {
        "@type": "UseAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": "https://api.readgzh.site/rd?url={wechat_url}",
          "actionPlatform": [
            "http://schema.org/DesktopWebPlatform"
          ],
          "description": "粘贴微信公众号文章链接，获取 AI 可读的纯净内容"
        }
      },
      "sameAs": [
        "https://github.com/sweesama",
        "https://clawhub.io/skills/readgzh"
      ],
      "keywords": "微信公众号,AI阅读,WeChat,ChatGPT,Claude,Perplexity,API,MCP",
      "@id": "https://readgzh.site/#app",
      "publisher": {
        "@id": "https://readgzh.site/#org"
      }
    }
  ]
};
