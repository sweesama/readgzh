const steps = [
  {
    num: "01",
    title: "粘贴链接",
    desc: "将微信公众号文章 URL 提交给 ReadGZH。系统在服务端代理抓取该文章页面，无需安装插件或本地客户端。",
  },
  {
    num: "02",
    title: "深度提取",
    desc: "递归解析微信编辑器输出的深层嵌套结构（<span>、<leaf>、<text>），剥离私有标签、内联样式和 data 属性，转换为更适合 AI 读取的精简内容。",
  },
  {
    num: "03",
    title: "共享缓存",
    desc: "清洗后的文章存入共享缓存，图片通过 CDN 代理转发以便在站外正常显示。命中缓存时后续读取不扣积分（仍有基础频率限制）。",
  },
];

const HowItWorksSection = () => (
  <section id="how-it-works" className="container mx-auto px-4 py-20">
    <div className="max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-12">
        工作原理
      </h2>
      <div className="grid gap-8 md:grid-cols-3">
        {steps.map((s) => (
          <div key={s.num} className="relative pl-16">
            <span className="absolute left-0 top-0 text-5xl font-black text-primary/15 leading-none select-none">
              {s.num}
            </span>
            <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {s.desc}
            </p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export default HowItWorksSection;
