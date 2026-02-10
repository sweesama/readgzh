import { useEffect } from "react";
import HeroSection from "@/components/home/HeroSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import AdvantagesSection from "@/components/home/AdvantagesSection";
import AIGuideSection from "@/components/home/AIGuideSection";
import StatsSection from "@/components/home/StatsSection";

const Index = () => {
  // Auto-submit if ?url= param is present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const autoUrl = params.get("url");
    if (autoUrl && autoUrl.includes("weixin.qq.com")) {
      window.history.replaceState({}, "", "/");
      setTimeout(() => {
        document.getElementById("auto-submit-trigger")?.click();
      }, 100);
    }
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <HeroSection />
      <StatsSection />
      <FeaturesSection />
      <AdvantagesSection />
      <AIGuideSection />
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>微信文章 AI 阅读器 - 让 AI 能够读取微信公众号内容</p>
          <p className="mt-2">本服务仅用于个人学习和研究目的</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
