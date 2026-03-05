import { Sparkles, Eraser, TrendingDown, ShieldOff, FileText, Cloud, Images, Split, Brain, Database } from "lucide-react";

const advantages = [
  { icon: Eraser, title: "去除所有样式噪音", desc: "自动剥离 inline style、class、data 属性，只保留纯净语义内容" },
  { icon: TrendingDown, title: "Token 消耗减少 50%+", desc: "清理空标签、嵌套容器，大幅压缩无效字符，降低 AI 调用成本" },
  { icon: ShieldOff, title: "过滤微信私有标签", desc: "移除 <mp-common-profile> 等自定义组件，避免 AI 解析困惑" },
  { icon: Images, title: "支持图片消息模板", desc: "自动识别「小绿书」图集格式，提取图片和文字，图文消息都能处理" },
  { icon: Split, title: "长文智能分页", desc: "超长文章按段落边界拆分为 ~40KB 分块，通过 ?part=N 逐段读取" },
  { icon: Brain, title: "AI 智能摘要", desc: "Pro 专属：?mode=summary 获取结构化摘要，无需读全文即可获取核心情报" },
  { icon: FileText, title: "纯 HTML 直出", desc: "无需 JavaScript 渲染，AI 爬虫直接获取完整内容，兼容所有 AI 平台" },
  { icon: Cloud, title: "云端零安装", desc: "无需本地部署、无需浏览器插件，一个 URL 搞定，随时随地可用" },
  { icon: Database, title: "智能缓存永久存储", desc: "已抓取文章永久缓存，重复读取零消耗，多个 Agent 共享同一份数据" },
];

const AdvantagesSection = () => (
  <div className="container mx-auto px-4 py-16">
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center gap-2 justify-center mb-2">
        <Sparkles className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-bold text-center">专为 AI 深度优化</h2>
      </div>
      <p className="text-center text-muted-foreground mb-10">
        不只是简单转发，我们对输出内容做了大量精简处理，让 AI 读得更快、更准、更省 Token
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {advantages.map((item, i) => (
          <div key={i} className="flex gap-4 p-5 rounded-xl border bg-card hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

export default AdvantagesSection;
