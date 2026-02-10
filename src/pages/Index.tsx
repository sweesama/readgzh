import { useEffect, useRef, useState } from "react";
import HeroSection from "@/components/home/HeroSection";
import FeaturesSection from "@/components/home/FeaturesSection";
import AdvantagesSection from "@/components/home/AdvantagesSection";
import AIGuideSection from "@/components/home/AIGuideSection";
import StatsWidget from "@/components/home/StatsSection";
import { Bot, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

const Index = () => {
  const [aiView, setAiView] = useState(false);

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

  if (aiView) {
    return <MatrixView onExit={() => setAiView(false)} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <StatsWidget />
      {/* AI View toggle */}
      <div className="fixed top-4 left-4 z-50">
        <Button
          size="sm"
          variant="outline"
          onClick={() => setAiView(true)}
          className="gap-1.5 rounded-full bg-card/80 backdrop-blur-md shadow-sm text-xs"
        >
          <Bot className="h-3.5 w-3.5" />
          AI 视角
        </Button>
      </div>

      <HeroSection />
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

/** Vertical falling Matrix rain effect */
const MatrixRain = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const chars = "01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン<>/{}=;";
    const fontSize = 14;
    const columns = Math.floor(canvas.width / fontSize);
    const drops: number[] = Array.from({ length: columns }, () => Math.random() * -100);

    const draw = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0.05)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < drops.length; i++) {
        const char = chars[Math.floor(Math.random() * chars.length)];
        const x = i * fontSize;
        const y = drops[i] * fontSize;

        // Bright head
        ctx.fillStyle = `rgba(0, 255, 70, ${0.9 + Math.random() * 0.1})`;
        ctx.font = `${fontSize}px monospace`;
        ctx.fillText(char, x, y);

        // Dimmer trail
        if (drops[i] > 1) {
          const trailChar = chars[Math.floor(Math.random() * chars.length)];
          ctx.fillStyle = "rgba(0, 180, 50, 0.3)";
          ctx.fillText(trailChar, x, y - fontSize);
        }

        if (y > canvas.height && Math.random() > 0.975) {
          drops[i] = 0;
        }
        drops[i] += 0.5 + Math.random() * 0.5;
      }
    };

    const interval = setInterval(draw, 45);
    return () => {
      clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      style={{ opacity: 0.4 }}
    />
  );
};

/** Matrix-style AI perspective of the homepage */
const MatrixView = ({ onExit }: { onExit: () => void }) => {
  const [lines, setLines] = useState<string[]>([]);

  const contentLines = [
    "> INITIALIZING AI READER INTERFACE...",
    "> PROTOCOL: WeChat Article Extraction v2.1",
    "> TARGET: mp.weixin.qq.com/*",
    "",
    "┌─────────────────────────────────────────┐",
    "│  SYSTEM: 微信文章 AI 阅读器              │",
    "│  STATUS: ONLINE                         │",
    "│  UPTIME: 99.97%                         │",
    "└─────────────────────────────────────────┘",
    "",
    "> PIPELINE SEQUENCE:",
    "  [1] INTERCEPT  → Fetch WeChat HTML payload",
    "  [2] SANITIZE   → Strip <style>, class=, data-*",
    "  [3] FILTER     → Remove <mp-*> proprietary tags",
    "  [4] OPTIMIZE   → Reduce token count by ~50%",
    "  [5] PROXY      → Route images via edge CDN",
    "  [6] CACHE      → Store in persistent DB layer",
    "  [7] SERVE      → Output SSR HTML (no JS required)",
    "",
    "> SUPPORTED AI CONSUMERS:",
    "  ✓ ChatGPT    (OpenAI)",
    "  ✓ Claude     (Anthropic)",
    "  ✓ Perplexity (Perplexity AI)",
    "  ✓ Gemini     (Google DeepMind)",
    "  ✓ Any HTTP-capable LLM agent",
    "",
    "> API ENDPOINT:",
    "  GET /functions/v1/wechat-reader?url={WECHAT_URL}",
    "  → Returns: text/html (AI-optimized, zero JS)",
    "",
    "> CONTENT TRANSFORMATION SAMPLE:",
    "  INPUT:  <div class=\"rich_media\" data-id=\"x\" style=\"...\">",
    "  OUTPUT: <div>",
    "  REDUCTION: 87% fewer tokens",
    "",
    "> READY. Paste a WeChat URL to begin extraction._",
  ];

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < contentLines.length) {
        const line = contentLines[i];
        setLines((prev) => [...prev, line]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 60);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen bg-black text-green-400 font-mono relative overflow-hidden">
      {/* Matrix rain columns */}
      <MatrixRain />

      {/* Exit button */}
      <div className="fixed top-4 left-4 z-50">
        <Button
          size="sm"
          variant="outline"
          onClick={onExit}
          className="gap-1.5 rounded-full border-green-800 bg-black/80 text-green-400 hover:bg-green-950 hover:text-green-300 text-xs"
        >
          <Eye className="h-3.5 w-3.5" />
          人类视角
        </Button>
      </div>

      {/* Terminal content */}
      <div className="relative container mx-auto px-4 py-20 max-w-3xl">
        <div className="border border-green-900 rounded-lg bg-black/80 p-6 shadow-[0_0_30px_rgba(0,255,0,0.05)]">
          {/* Terminal header */}
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-green-900/50">
            <div className="w-3 h-3 rounded-full bg-red-500/80" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
            <div className="w-3 h-3 rounded-full bg-green-500/80" />
            <span className="ml-3 text-green-600 text-xs">ai-reader@wechat-proxy ~ $</span>
          </div>

          {/* Lines */}
          <div className="space-y-0.5 text-sm leading-relaxed">
            {lines.map((line, i) => (
              <div key={i} className={`${line?.startsWith(">") ? "text-green-300" : line?.startsWith("  ✓") ? "text-emerald-400" : "text-green-500/80"}`}>
                {line || "\u00A0"}
              </div>
            ))}
            {lines.length < contentLines.length && (
              <span className="inline-block w-2 h-4 bg-green-400 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
