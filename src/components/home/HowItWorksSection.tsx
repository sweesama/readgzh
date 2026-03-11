const steps = [
  {
    num: "01",
    title: "粘贴链接",
    desc: "将微信公众号文章 URL 提交给 ReadGZH。系统通过服务端代理发起请求，绕过微信的客户端指纹检测——这是任何浏览器插件或客户端工具都无法做到的。",
  },
  {
    num: "02",
    title: "深度提取",
    desc: "七层解析管线递归穿透微信最新编辑器输出的深层嵌套结构（<span>、<leaf>、<text>），剥离所有私有标签、内联样式和 data 属性，Token 消耗降低 50–87%。",
  },
  {
    num: "03",
    title: "永久缓存",
    desc: "清洗后的文章存入全局缓存，图片通过 CDN 代理永久可访问。任何后续读取——无论是人还是 AI Agent——均免费，构建开放的微信内容知识库。",
  },
];

const HowItWorksSection = () => (
  <section className="container mx-auto px-4 py-20">
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
