import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle, ArrowRight, AlertCircle } from "lucide-react";
// Article submission is handled via edge function (server-side validation)

/**
 * SubmitPage 处理来自 Bookmarklet 的 POST 请求
 * Bookmarklet 会通过表单 POST 提交文章数据到此页面
 */
const SubmitPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [articleId, setArticleId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    // 从 URL 查询参数获取数据（Bookmarklet 可能通过 GET 传递）
    const title = searchParams.get("title");
    const author = searchParams.get("author");
    const content = searchParams.get("content");
    const sourceUrl = searchParams.get("sourceUrl");
    const publishTime = searchParams.get("publishTime");

    // 如果没有数据，尝试从 sessionStorage 获取（POST 跳转后的备用方案）
    const sessionData = sessionStorage.getItem("bookmarklet_data");
    
    let articleData: {
      title: string;
      author: string;
      content: string;
      sourceUrl: string;
      publishTime: string;
    } | null = null;

    if (title && content) {
      articleData = {
        title,
        author: author || "未知作者",
        content,
        sourceUrl: sourceUrl || "",
        publishTime: publishTime || "",
      };
    } else if (sessionData) {
      try {
        articleData = JSON.parse(sessionData);
        sessionStorage.removeItem("bookmarklet_data");
      } catch {
        // ignore parse errors
      }
    }

    if (!articleData || !articleData.title || !articleData.content) {
      setStatus("error");
      setErrorMessage("未接收到有效的文章数据。请确保在微信公众号文章页面使用书签工具。");
      return;
    }

    // 保存文章到数据库（通过 edge function，带服务端验证）
    const saveArticle = async () => {
      try {
        const title = articleData!.title.trim().substring(0, 500);
        const content = articleData!.content.trim().substring(0, 500000);
        const author = articleData!.author.trim().substring(0, 100) || "未知作者";
        const sourceUrl = articleData!.sourceUrl.trim().substring(0, 2000) || "";
        const publishTime = articleData!.publishTime.trim().substring(0, 100) || "";

        if (!title || !content || content.length < 10) {
          throw new Error("文章标题或内容无效");
        }

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/wechat-reader`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              action: "submit",
              title,
              author,
              content,
              sourceUrl,
              publishTime,
            }),
          }
        );

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.error || "保存文章失败");
        }

        setArticleId(result.articleId);
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "保存文章失败，请重试");
      }
    };

    saveArticle();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-center">正在保存文章...</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="max-w-md w-full mx-4 border-destructive">
          <CardHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle className="text-center text-destructive">保存失败</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">{errorMessage}</p>
            <Button onClick={() => navigate("/")} variant="outline">
              返回首页
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardHeader>
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-center">文章保存成功！</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <p className="text-muted-foreground">
            文章已保存到平台，现在可以分享给 AI 工具阅读了。
          </p>
          
          <div className="bg-muted rounded-lg p-4">
            <p className="text-sm text-muted-foreground mb-2">AI 可访问链接：</p>
            <code className="text-xs break-all text-foreground">
              {window.location.origin}/a/{articleId}
            </code>
          </div>
          
          <Button onClick={() => navigate(`/a/${articleId}`)} className="w-full">
            查看文章
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SubmitPage;
