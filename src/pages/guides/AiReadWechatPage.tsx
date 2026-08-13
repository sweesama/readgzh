import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowLeft,
  ArrowRight,
  Link2,
  ClipboardCopy,
  Code,
  Key,
  AlertTriangle,
  ShieldCheck,
  Coins,
} from "lucide-react";
import Footer from "@/components/home/Footer";
import SEO from "@/components/SEO";

const faqs = [
  {
    q: "ChatGPT 能直接打开我给它的链接吗？",
    a: "取决于它当前是否开启了联网/浏览工具。开启时通常可以直接抓取 ReadGZH 链接；未开启（或在某些企业/离线环境下）则打不开，这时请改用「复制正文」的方式。ReadGZH 无法控制各家 AI 的联网权限。",
  },
  {
    q: "为什么 AI 说它读不到我的微信链接？",
    a: "微信公众号对站外访问有严格限制，AI 直接请求 mp.weixin.qq.com 链接时通常拿不到正文。先用 ReadGZH 把文章转换成可访问的页面，再把 ReadGZH 生成的链接给 AI。",
  },
  {
    q: "转换一篇文章要多少积分？",
    a: "未缓存的文章统一 3 积分/篇。已被别人转换过的文章命中缓存，读取不消耗积分（仍有基础的频率与滥用保护）。",
  },
  {
    q: "不注册能用吗？额度是多少？",
    a: "可以。未登录 / 未携带 API Key 时，新文章提取按每个 IP 每天 10 积分计。注册后创建免费 API Key，每天可领取 30 积分；Lite 每月 300 积分，Pro / Pro Lifetime 每月 2,000 积分，自动发放无需每日领取。",
  },
  {
    q: "哪些文章转换不了？",
    a: "已被删除的文章、仅含视频号内容的推文、需要授权或登录才能查看的内容，通常无法提取，系统会明确报错而不是返回残缺内容。",
  },
  {
    q: "转换后的内容会被公开吗？",
    a: "会。转换后的文章页面是公开可访问的，也可能出现在文章库中。请不要转换涉及个人隐私、内部资料或未授权传播的内容；请遵守原作者的版权与平台规则，并在引用时注明来源。",
  },
];

const Step = ({ n, title, children }: { n: string; title: string; children: React.ReactNode }) => (
  <div className="relative pl-12">
    <span className="absolute left-0 top-0 h-8 w-8 rounded-full bg-primary/10 text-primary font-semibold flex items-center justify-center text-sm">
      {n}
    </span>
    <h4 className="font-semibold mb-1">{title}</h4>
    <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
  </div>
);

const AiReadWechatPage = () => (
  <div className="min-h-screen bg-background">
    <SEO
      title="如何让 AI 读取微信公众号文章（2026 实操指南）"
      description="ChatGPT、Claude、DeepSeek、豆包打不开微信公众号链接？本指南给出三种可行做法：生成 AI 可读链接、复制转换后的正文、用 REST API / MCP 接入，并说明真实额度与限制。"
      path="/guides/ai-read-wechat"
      ogType="article"
      jsonLd={[
        {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        },
        {
          "@context": "https://schema.org",
          "@type": "HowTo",
          name: "如何让 AI 读取微信公众号文章",
          inLanguage: "zh-CN",
          step: [
            { "@type": "HowToStep", name: "复制微信文章链接", text: "在微信中点击右上角「…」→ 复制链接，得到 mp.weixin.qq.com 开头的地址。" },
            { "@type": "HowToStep", name: "用 ReadGZH 转换", text: "把链接粘贴到 ReadGZH 首页，生成 AI 可访问的公开页面。" },
            { "@type": "HowToStep", name: "把结果交给 AI", text: "AI 能联网时直接给它 ReadGZH 链接；不能联网时复制转换后的正文粘贴到对话中。" },
          ],
        },
      ]}
    />

    <div className="container mx-auto px-4 py-10 max-w-3xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" />返回首页
        </Button>
      </Link>

      <header className="mb-10">
        <p className="text-sm text-primary font-medium mb-2">使用指南</p>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
          如何让 ChatGPT、Claude、DeepSeek、豆包读取微信公众号文章
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          你把一条 <code className="bg-muted px-1 rounded text-sm">mp.weixin.qq.com</code> 链接发给 AI，它却回复「无法访问该网页」或者干脆开始编造内容。
          原因是微信公众号对站外访问有严格限制，AI 直接请求这类链接时通常拿不到正文。
          下面是三种目前实际可行的做法，按你的使用场景选一种就行。
        </p>
      </header>

      {/* Quick CTA */}
      <Card className="mb-10 border-primary/30 bg-primary/5">
        <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="font-semibold">先试一下最快的方式</p>
            <p className="text-sm text-muted-foreground">粘贴一条微信文章链接，生成 AI 可读页面。</p>
          </div>
          <Link to="/">
            <Button className="gap-1.5 w-full sm:w-auto">
              立即转换<ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Scenario A */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">方案 A：AI 能访问网页时，直接给它可读链接</h2>
        </div>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          适合 ChatGPT（开启联网/搜索）、Claude（开启网页工具）、Perplexity、以及大多数带浏览能力的 AI 客户端。
        </p>
        <div className="space-y-6">
          <Step n="1" title="复制微信文章链接">
            <p>在微信里打开文章 → 右上角「…」→「复制链接」，得到 <code className="bg-muted px-1 rounded">https://mp.weixin.qq.com/s/...</code>。</p>
          </Step>
          <Step n="2" title="在 ReadGZH 首页粘贴并生成">
            <p>粘贴后点击「生成」。系统会在服务端抓取文章、剥离样式与微信私有标签，生成一个公开可访问的精简页面。</p>
          </Step>
          <Step n="3" title="复制链接给 AI">
            <p>在结果页点「复制链接给 AI」，得到形如 <code className="bg-muted px-1 rounded break-all">https://api.readgzh.site/rd?s=文章标识</code> 的地址。</p>
          </Step>
          <Step n="4" title="给 AI 一句明确的提示">
            <p className="bg-muted rounded-lg p-3 font-mono text-xs leading-relaxed">
              请访问这个链接并读取完整正文，然后用中文总结要点，并标注原文出处：&lt;粘贴 ReadGZH 链接&gt;
            </p>
            <p>长文可以加 <code className="bg-muted px-1 rounded">&amp;format=text</code> 让输出为 Markdown，更容易被模型解析。</p>
          </Step>
        </div>
      </section>

      {/* Scenario B */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <ClipboardCopy className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">方案 B：AI 不能联网时，复制正文粘贴过去</h2>
        </div>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          适合未开联网的 ChatGPT、部分 DeepSeek / 豆包 / Kimi 会话、公司内网环境，以及任何「打不开外链」的场景。
        </p>
        <div className="space-y-6">
          <Step n="1" title="照方案 A 完成转换">
            <p>拿到 ReadGZH 的文章结果页。</p>
          </Step>
          <Step n="2" title="点「复制全文」">
            <p>复制到的内容是清理后的纯文本（含标题、作者、发布时间和原文链接），不带样式噪音。</p>
          </Step>
          <Step n="3" title="粘贴进 AI 对话">
            <p className="bg-muted rounded-lg p-3 font-mono text-xs leading-relaxed">
              以下是一篇微信公众号文章的正文，请基于它回答我的问题，不要引入文中没有的信息：<br />
              ---<br />
              &lt;粘贴正文&gt;
            </p>
          </Step>
          <Step n="4" title="正文太长怎么办">
            <p>超长文章可分段粘贴，每段前标注「第 N 段，共 M 段，先不要总结」，全部贴完后再提问。若你用的是 API，可以用 <code className="bg-muted px-1 rounded">&amp;part=N</code> 分块读取。</p>
          </Step>
        </div>
      </section>

      {/* Scenario C */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <Code className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">方案 C：开发者与自动化，用 REST API / MCP</h2>
        </div>
        <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
          适合批量处理、工作流（Coze / Dify / n8n）、以及 Cursor、Claude Code 等支持 MCP 的编辑器与 Agent。
        </p>
        <div className="space-y-4 text-sm">
          <div className="rounded-lg border bg-card p-4">
            <p className="font-medium mb-2">REST API</p>
            <pre className="bg-muted rounded p-3 overflow-x-auto text-xs"><code>{`curl -H "Authorization: Bearer sk_live_..." \\
  "https://api.readgzh.site/rd?url=<微信文章链接>&format=text"`}</code></pre>
            <p className="text-muted-foreground mt-2">
              响应头包含 <code className="bg-muted px-1 rounded">X-Cache</code>、<code className="bg-muted px-1 rounded">X-Credit-Cost</code>、<code className="bg-muted px-1 rounded">X-Credits-Remaining</code>，方便你判断是否命中缓存。
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="font-medium mb-2">MCP Server</p>
            <p className="text-muted-foreground">
              端点 <code className="bg-muted px-1 rounded break-all">POST https://api.readgzh.site/mcp-server</code>，在支持 MCP 的客户端里配置后，Agent 可以直接调用读取工具。
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="font-medium mb-2">务必带上 API Key</p>
            <p className="text-muted-foreground">
              ChatGPT、Claude 的工具运行环境以及 Vercel、Cloudflare 等共享出口 IP，匿名额度经常早已被别人用完。带 Key 请求可绕开 IP 额度。Key 放在请求头，不要放在 URL 里。
            </p>
          </div>
          <Link to="/docs">
            <Button variant="outline" className="gap-1.5">
              <Code className="h-4 w-4" />查看开发者文档
            </Button>
          </Link>
        </div>
      </section>

      {/* Limits */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <Coins className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">真实额度与消耗</h2>
        </div>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="text-left p-3 font-medium">场景</th>
                <th className="text-left p-3 font-medium">额度 / 消耗</th>
              </tr>
            </thead>
            <tbody className="[&>tr]:border-t">
              <tr><td className="p-3">未缓存文章（任何方式）</td><td className="p-3">3 积分 / 篇</td></tr>
              <tr><td className="p-3">已缓存文章</td><td className="p-3">不消耗积分（仍有频率与滥用保护）</td></tr>
              <tr><td className="p-3">未登录 / 无 API Key</td><td className="p-3">每 IP 每天 10 积分</td></tr>
              <tr><td className="p-3">免费注册 API Key</td><td className="p-3">每天 30 积分，需每日领取</td></tr>
              <tr><td className="p-3">Lite</td><td className="p-3">每月 300 积分，自动发放</td></tr>
              <tr><td className="p-3">Pro / Pro Lifetime</td><td className="p-3">每月 2,000 积分，自动发放</td></tr>
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link to="/dashboard">
            <Button className="gap-1.5"><Key className="h-4 w-4" />创建免费 API Key</Button>
          </Link>
          <Link to="/pricing">
            <Button variant="outline">对比套餐</Button>
          </Link>
        </div>
      </section>

      {/* Pitfalls */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">常见错误与限制</h2>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li><strong className="text-foreground">直接把微信链接丢给 AI</strong> — 多数情况下拿不到正文，模型可能凭标题编内容。务必先转换。</li>
          <li><strong className="text-foreground">AI 声称读了但内容对不上</strong> — 说明它其实没抓到页面。换用方案 B 直接粘贴正文。</li>
          <li><strong className="text-foreground">提取失败</strong> — 已删除文章、仅视频号内容、需要授权的内容无法提取，系统会明确报错。</li>
          <li><strong className="text-foreground">共享 IP 额度被占满</strong> — 在云端/托管环境调用时请使用 API Key。</li>
          <li><strong className="text-foreground">超长文章被截断</strong> — 用 <code className="bg-muted px-1 rounded">?part=N</code> 分块读取，或分段粘贴。</li>
          <li><strong className="text-foreground">视频、小程序、投票等交互内容</strong> — 只能保留跳转入口，无法转成文本。</li>
        </ul>
      </section>

      {/* Privacy */}
      <section className="mb-12">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-2xl font-bold">隐私与合规提示</h2>
        </div>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li>转换后的页面是<strong className="text-foreground">公开可访问</strong>的，并可能出现在文章库中。不要转换内部资料、含个人隐私或未授权传播的内容。</li>
          <li>文章版权属于原作者。ReadGZH 只做格式转换，请在引用、摘录时注明原文出处并保留原文链接。</li>
          <li>如果你是权利人并希望移除某篇缓存，可通过留言板或支持邮箱联系我们。</li>
          <li>请遵守微信公众平台与你所在地区的相关规定，不要用于批量抓取或商业转载。</li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">常见问题</h2>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={i} value={`g-${i}`}>
              <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
              <AccordionContent className="text-muted-foreground leading-relaxed">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* Final CTA */}
      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-lg">现在就试试</CardTitle>
          <CardDescription>先转换一篇文章，用得顺手再考虑 API Key 和套餐。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-3">
          <Link to="/" className="flex-1">
            <Button className="w-full gap-1.5">立即转换<ArrowRight className="h-4 w-4" /></Button>
          </Link>
          <Link to="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full gap-1.5"><Key className="h-4 w-4" />创建免费 API Key</Button>
          </Link>
          <Link to="/docs" className="flex-1">
            <Button variant="ghost" className="w-full gap-1.5"><Code className="h-4 w-4" />开发者文档</Button>
          </Link>
        </CardContent>
      </Card>
    </div>

    <Footer />
  </div>
);

export default AiReadWechatPage;
