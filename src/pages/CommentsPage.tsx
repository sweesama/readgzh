import { Link } from "react-router-dom";
import { Bot, BookOpen, Code, Zap, Key, MessageSquare, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Footer from "@/components/home/Footer";
import CommentSection from "@/components/home/CommentSection";
import { useAuth } from "@/hooks/useAuth";

const CommentsPage = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top bar - consistent with main site */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 py-3 flex items-center justify-between">
        <Link to="/">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 rounded-full bg-card/80 backdrop-blur-md shadow-sm text-xs"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            首页
          </Button>
        </Link>

        <div className="flex items-center gap-2">
          <Link to="/articles">
            <Button size="sm" variant="ghost" className="gap-1.5 rounded-full bg-card/80 backdrop-blur-md shadow-sm text-xs">
              <BookOpen className="h-3.5 w-3.5" />
              文章库
            </Button>
          </Link>
          <Link to="/docs">
            <Button size="sm" variant="ghost" className="gap-1.5 rounded-full bg-card/80 backdrop-blur-md shadow-sm text-xs">
              <Code className="h-3.5 w-3.5" />
              文档
            </Button>
          </Link>
          <Link to="/pricing">
            <Button size="sm" variant="ghost" className="gap-1.5 rounded-full bg-card/80 backdrop-blur-md shadow-sm text-xs">
              <Zap className="h-3.5 w-3.5" />
              定价
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button size="sm" variant="ghost" className="gap-1.5 rounded-full bg-card/80 backdrop-blur-md shadow-sm text-xs">
              <Key className="h-3.5 w-3.5" />
              控制台
            </Button>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 pt-20 pb-8">
        <div className="max-w-2xl mx-auto px-4">
          {/* Page header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-3">
              <MessageSquare className="h-6 w-6 text-primary" />
              <h1 className="text-2xl font-bold text-foreground">留言板</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              欢迎留下你的想法、建议或反馈 ✨
            </p>
          </div>

          {/* Login prompt for unauthenticated users */}
          {!user && (
            <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4 text-center">
              <p className="text-sm text-muted-foreground mb-3">
                登录后即可发表留言、回复评论
              </p>
              <Link to="/dashboard">
                <Button size="sm" className="gap-1.5">
                  <Key className="h-3.5 w-3.5" />
                  前往控制台登录
                </Button>
              </Link>
            </div>
          )}

          <CommentSection />
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CommentsPage;
