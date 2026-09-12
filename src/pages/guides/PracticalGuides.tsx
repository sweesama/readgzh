import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import SEO from "@/components/SEO";
import Footer from "@/components/home/Footer";

function Guide({ title, description, path, children }: { title: string; description: string; path: string; children: ReactNode }) {
  return <div className="min-h-screen bg-background">
    <SEO title={`${title} | ReadGZH`} description={description} path={path} ogType="article" />
    <main className="container mx-auto max-w-3xl px-4 py-10">
      <Link to="/guides/ai-read-wechat" className="text-primary underline">返回 AI 阅读使用指南</Link>
      <header className="my-8"><h1 className="text-3xl font-bold tracking-tight mb-4">{title}</h1><p className="text-muted-foreground leading-relaxed">{description}</p><p className="mt-3 text-sm text-muted-foreground">ReadGZH 项目维护 · 更新于 2026-09-12</p></header>
      <article className="space-y-8 leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_p]:my-3 [&_a]:text-primary [&_a]:underline [&_li]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre]:text-sm [&_blockquote]:border-l-4 [&_blockquote]:pl-4">
        {children}
      </article>
      <nav aria-label="相关使用指南" className="mt-10 border-t pt-6 flex flex-wrap gap-4 text-sm text-primary underline">
        <Link to="/">转换一篇文章</Link><Link to="/guides/wechat-to-markdown">公众号转 Markdown</Link><Link to="/guides/compare-wechat-articles">多篇文章对比</Link><Link to="/docs">API / MCP 文档</Link>
      </nav>
    </main><Footer />
  </div>;
}

export function WechatMarkdownPage() {
  return <Guide title="微信公众号文章转 Markdown：保存正文，再交给 AI" description="从已有公众号链接取得 Markdown 正文：阅读链接参数、实测输出、保存 .md 文件，以及导入笔记和 AI 前的完整性检查。" path="/guides/wechat-to-markdown">
    <section><h2>什么时候需要转换？</h2><p>已经拿到公众号文章链接，希望把正文交给 AI、存成 Markdown 文件或整理进笔记时，可以使用 ReadGZH 的文本输出。这里是“公众号文章 → Markdown”，不是把 Markdown 排版后发布到公众号。</p><p>少量文字能直接复制时，粘贴即可；持续接入 Agent 才需要考虑 MCP。ReadGZH 负责云端提取，后续摘要和判断由 AI 与使用者完成。</p></section>
    <section><h2>三步取得 Markdown</h2><ol><li>在 <Link to="/">ReadGZH 首页</Link> 粘贴公开公众号链接，生成阅读页。</li><li>复制结果链接，在已有的查询参数后添加 <code>&amp;format=text</code>。</li><li>打开文本结果，复制保存为 UTF-8 编码的 <code>.md</code> 文件，再按目标工具支持的方式粘贴或导入。</li></ol><pre><code>{'https://api.readgzh.site/rd?s=文章标识&format=text'}</code></pre><p>链接已有 <code>?s=...</code>，新增参数用 <code>&amp;</code>，不要再加一个问号。保存失败或出现错误提示时，先排查错误，不要把错误正文当作文章。</p></section>
    <section><h2>实测输出是什么样？</h2><p>2026-09-12 对一篇已有缓存文章的请求返回 HTTP 200，正文开头如下：</p><pre><code>{'# GEO还没搞明白，同行已经在做AEO了\n\n**作者：** 阿然的奇思妙想\n**发布时间：** 2026-09-08 17:57'}</code></pre><p><a href="https://api.readgzh.site/rd?s=0oYf5WLZHdLpBoNUO1tePQ&format=text">查看本次格式示例</a>。这是输出格式核对，不是提取成功率测试，也不代表认同该文章的 AEO/GEO 结论。</p><p>响应类型实测为 <code>text/plain; charset=utf-8</code>，正文使用 Markdown 语法；程序不要仅因类型不是 <code>text/markdown</code> 就判定失败。样例中仍有来源标记，输出不保证完全无杂质。</p></section>
    <section><h2>交给 AI 或导入笔记前，检查四件事</h2><ul><li>标题、作者与日期是否对应目标文章，笔记中是否保留原始微信链接。</li><li>对照开头、结尾和关键段落；长文有分块提示时，补齐其余部分再分析。</li><li>图片链接不等于图片里的文字已提取，关键图表应回原文核对。</li><li>在目标笔记工具中检查标题、图片和表格排版。手动导入不代表 ReadGZH 提供自动同步集成。</li></ul><blockquote>请先说明实际收到的正文范围；若有缺段、分块提示或仅有图片链接，请明确指出。只依据所给正文总结，每个主要结论附可核对的原文短句。把作者观点、文中数据与你的推断分开。</blockquote></section>
    <section><h2>开发者从原始链接调用</h2><p>将原始微信 URL 作为编码后的 <code>url</code> 参数，并设置 <code>format=text</code>。微信链接中可能包含多个 <code>&amp;</code>，应由 HTTP 客户端编码，避免被误当成 ReadGZH 参数。API Key 放请求头，不放公开链接。</p><p><a href="https://github.com/sweesama/readgzh/blob/main/docs/wechat-to-markdown.md">查看可复制的 curl 示例</a>，或查阅 <Link to="/docs">完整接口说明</Link>。需要对比多篇文章时，<Link to="/guides/compare-wechat-articles">先保留每篇独立来源，再做比较</Link>。</p></section>
    <section><h2>额度和适用范围</h2><p>未缓存文章按积分计费，缓存读取不扣积分，仍有频率与滥用保护；最新额度见 <Link to="/pricing">定价页</Link>。ReadGZH 使用云端处理和共享缓存，生成的文章页公开可访问，不适合内部或不宜公开的资料。</p><p>已删除、受限或不支持的文章可能无法提取；转换不能恢复无权访问的正文，也不保证图片永久可用。缓存不等于完整公众号历史数据库。请保留出处并遵守原作者的使用授权。</p></section>
  </Guide>;
}

export function CompareWechatPage() {
  return <Guide title="多篇公众号文章怎么让 AI 对比，而不是分别写摘要？" description="逐篇取得正文，保留 A/B/C 来源卡片，用证据表区分观点冲突、统计口径和缺失信息。附可复制的比较提示词。" path="/guides/compare-wechat-articles">
    <section><h2>先取得正文，再让 AI 比较</h2><p>把三条链接一起发给 AI，并不能证明它读到了三篇文章。先逐篇获取内容，确认没有缺篇，再给出相同的比较维度。ReadGZH 可以提供正文；它不是一键批量对比功能，比较由你使用的 AI 完成。</p><p>能直接复制的正文可以直接使用。链接读取失败时，按 <Link to="/guides/ai-read-wechat">AI 阅读指南</Link> 逐篇生成可读页；AI 无法联网时，复制正文或使用 <Link to="/guides/wechat-to-markdown">Markdown 文件</Link>。</p></section>
    <section><h2>第一步：每篇建立来源卡片</h2><pre><code>{'来源编号：A（其他文章依次 B、C）\n标题：\n公众号 / 作者：\n发布日期：\n原始微信链接：\n正文：粘贴完整文本，或附 AI 能实际读取的材料\n完整性备注：缺失段落 / 仅图片 / 已补齐分块'}</code></pre><p>长文先逐篇整理证据卡，但保留全文，重要结论仍回到原文核对。不要把不同文章先拼成没有来源编号的大段落。</p></section>
    <section><h2>第二步：给出比较任务</h2><blockquote>只依据我提供的 A、B、C 三篇文章进行比较。先列出收到的文章标题和缺失、截断情况；缺材料时先指出，不要猜测。按相同维度列出每篇文章的主张、证据、时间范围、适用条件和一条原文短句，附来源编号。没有提到的写“未提及”。区分作者观点、文中报告的数据和你的推断。判断差异是实际矛盾，还是指标、时间或对象不同。如果多篇引用同一份报告，不要算成多份独立证据。最后列出仍需回原文核对的问题。</blockquote></section>
    <section><h2>第三步：检查“分歧”是不是真分歧</h2><p>下面是自拟教学示例，不是实测文章中的结论：</p><ul><li>A 说“订单增加”，B 说“利润下降”：指标不同，两者可能同时成立。</li><li>A 讨论一季度，B 讨论全年：时间范围不同，不能直接断言互相推翻。</li><li>C 没讨论价格：应写“未提及”，不能写成“反对降价”。</li><li>A、B、C 都引用同一份报告：仍然只有一个底层来源，不能称“三方独立验证”。</li></ul><p>请 AI 按“比较维度 → A/B/C 证据 → 能否比较 → 待核对问题”组织结果。原文短句只能帮助定位；不能替代检查上下文，也不能证明作者的数据正确。</p></section>
    <section><h2>如果 AI 只给三段摘要怎么办？</h2><p>缩小任务：先只比较一个问题，例如“各篇用什么证据支持成本下降”。要求逐项对齐，标明每个判断来自哪篇。材料太长时分轮比较，避免为了塞进上下文而丢掉来源和关键限定条件。</p><p>图表中独有的数据、提取缺失的部分、付费或受限内容，不能靠提示词补齐。先补充有权使用的材料，再继续比较。</p></section>
    <section><h2>什么时候不该使用这个流程？</h2><p>ReadGZH 处理的是已有公开文章链接，不负责全微信主题检索、连续订阅或完整历史归档。其生成页面公开可访问，也使用共享缓存，不要提交不适合公开处理的资料。请保留原始出处，并在引用时核对作者与上下文。</p></section>
  </Guide>;
}
