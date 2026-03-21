const DemoVideoSection = () => (
  <section className="container mx-auto px-4 py-16">
    <div className="max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold text-center mb-8">产品演示</h2>
      <div className="rounded-xl overflow-hidden border bg-card shadow-sm">
        <video
          className="w-full aspect-video"
          controls
          preload="metadata"
          playsInline
          aria-label="ReadGZH 产品演示视频：展示如何将微信公众号文章链接转换为 AI 可读的纯净内容"
          title="ReadGZH 微信文章 AI 阅读器演示"
        >
          <source src="/videos/readgzh-demo.mp4" type="video/mp4" />
          您的浏览器不支持视频播放，请使用现代浏览器访问。
        </video>
      </div>
      <p className="text-center text-sm text-muted-foreground mt-4">
        从粘贴链接到 AI 可读，只需几秒钟
      </p>
    </div>
  </section>
);

export default DemoVideoSection;
