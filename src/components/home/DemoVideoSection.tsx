import { useRef, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

const DemoVideoSection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="relative rounded-xl overflow-hidden border bg-card shadow-sm group">
          <video
            ref={videoRef}
            className="w-full aspect-video"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-label="ReadGZH 产品演示视频：展示如何将微信公众号文章链接转换为 AI 可读的纯净内容"
            title="ReadGZH 微信文章 AI 阅读器演示"
          >
            <source src="/videos/readgzh-demo.mp4" type="video/mp4" />
            您的浏览器不支持视频播放，请使用现代浏览器访问。
          </video>
          <button
            onClick={toggleMute}
            className="absolute bottom-3 right-3 p-2 rounded-full bg-background/70 backdrop-blur-sm text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label={muted ? "开启声音" : "关闭声音"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          从粘贴链接到 AI 可读，只需几秒钟
        </p>
      </div>
    </section>
  );
};

export default DemoVideoSection;
