import { useRef, useState } from "react";
import { Volume2, Volume1, VolumeX } from "lucide-react";
import { Slider } from "@/components/ui/slider";

const DemoVideoSection = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.5);

  const toggleMute = () => {
    if (videoRef.current) {
      const next = !muted;
      videoRef.current.muted = next;
      setMuted(next);
    }
  };

  const handleVolume = (val: number[]) => {
    const v = val[0];
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      if (v === 0) {
        videoRef.current.muted = true;
        setMuted(true);
      } else if (muted) {
        videoRef.current.muted = false;
        setMuted(false);
      }
    }
  };

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

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
          </video>
          <div className="absolute bottom-3 right-3 flex items-center gap-2 px-2 py-1.5 rounded-full bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={toggleMute} aria-label={muted ? "开启声音" : "关闭声音"}>
              <VolumeIcon className="h-4 w-4 text-foreground" />
            </button>
            <Slider
              value={[muted ? 0 : volume]}
              min={0}
              max={1}
              step={0.05}
              onValueChange={handleVolume}
              className="w-20"
            />
          </div>
        </div>
        <p className="text-center text-sm text-muted-foreground mt-4">
          从粘贴链接到 AI 可读，只需几秒钟
        </p>
      </div>
    </section>
  );
};

export default DemoVideoSection;
