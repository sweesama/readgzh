import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

const faqs = [
  {
    q: "ReadGZH 是什么？",
    a: "ReadGZH 是一个微信公众号文章转换工具，能将微信文章转换为 AI 工具（如 ChatGPT、Claude、Perplexity 等）可直接访问的格式。",
  },
  {
    q: "为什么 AI 无法直接读取微信文章？",
    a: "微信公众号对外部访问有严格的反爬虫限制，AI 工具发送的请求会被拦截。ReadGZH 通过服务端代理绕过这些限制，并优化内容格式。",
  },
  {
    q: "支持哪些 AI 工具？",
    a: "支持所有能访问网页的 AI 工具，包括 ChatGPT、Claude、Perplexity、Gemini、Kimi 等。只要 AI 能通过 URL 获取网页内容，就可以使用。",
  },
  {
    q: "使用 ReadGZH 需要注册吗？",
    a: "不需要。ReadGZH 完全免费使用，无需注册或登录。",
  },
  {
    q: "转换后的文章会保存多久？",
    a: "转换后的文章会永久保存在我们的服务器上，您可以随时通过生成的链接访问。",
  },
  {
    q: "有使用次数限制吗？",
    a: "为防止滥用，每个 IP 每天有一定的请求次数限制。正常个人使用不会受到影响。",
  },
  {
    q: "支持哪些类型的微信文章？",
    a: "支持普通图文文章和图片消息（小绿书格式）。不支持视频号、小程序等非文章类型的内容。",
  },
];

const FAQPage = () => (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto px-4 py-12 max-w-3xl">
      <Link to="/">
        <Button variant="ghost" size="sm" className="mb-6 gap-1.5">
          <ArrowLeft className="h-4 w-4" />返回首页
        </Button>
      </Link>
      <h1 className="text-3xl font-bold mb-6">常见问题 (FAQ)</h1>
      <Accordion type="single" collapsible className="w-full">
        {faqs.map((faq, i) => (
          <AccordionItem key={i} value={`item-${i}`}>
            <AccordionTrigger className="text-left">{faq.q}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">{faq.a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  </div>
);

export default FAQPage;
