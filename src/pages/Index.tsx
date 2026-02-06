import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Zap, Code, Copy, ArrowRight, Bookmark, FileText, CheckCircle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const navigate = useNavigate();
  
  // 手动粘贴表单状态
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [content, setContent] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Bookmarklet 复制状态
  const [bookmarkletCopied, setBookmarkletCopied] = useState(false);

  // 生成 Bookmarklet 脚本
  const bookmarkletCode = `javascript:(function(){
    var title=document.querySelector('#activity-name')||document.querySelector('.rich_media_title');
    var author=document.querySelector('#js_name')||document.querySelector('.rich_media_meta_nickname');
    var content=document.querySelector('#js_content')||document.querySelector('.rich_media_content');
    var time=document.querySelector('#publish_time')||document.querySelector('.rich_media_meta_text');
    if(!content){alert('未找到文章内容，请在微信公众号文章页面使用');return;}
    var data={
      title:title?title.innerText.trim():'无标题',
      author:author?author.innerText.trim():'未知作者',
      content:content.innerText.trim(),
      sourceUrl:window.location.href,
      publishTime:time?time.innerText.trim():''
    };
    var form=document.createElement('form');
    form.method='POST';
    form.action='${window.location.origin}/submit';
    form.target='_blank';
    Object.keys(data).forEach(function(k){
      var input=document.createElement('input');
      input.type='hidden';
      input.name=k;
      input.value=data[k];
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  })();`;

  const handleSubmitArticle = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: "请填写必填项",
        description: "标题和正文内容不能为空",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("articles")
        .insert({
          title: title.trim(),
          author: author.trim() || "未知作者",
          content: content.trim(),
          source_url: sourceUrl.trim() || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast({
        title: "提交成功",
        description: "文章已保存，正在跳转到阅读页面...",
      });

      // 跳转到公开阅读页面
      navigate(`/a/${data.id}`);
    } catch (err) {
      console.error("Error submitting article:", err);
      toast({
        title: "提交失败",
        description: err instanceof Error ? err.message : "请稍后重试",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyBookmarklet = () => {
    navigator.clipboard.writeText(bookmarkletCode);
    setBookmarkletCopied(true);
    toast({
      title: "已复制",
      description: "请在浏览器中创建新书签，将代码粘贴到网址栏",
    });
    setTimeout(() => setBookmarkletCopied(false), 3000);
  };

  const apiEndpoint = `${window.location.origin}/a/{文章ID}`;

  const copyApiExample = () => {
    navigator.clipboard.writeText(apiEndpoint);
    toast({
      title: "已复制",
      description: "API 地址已复制到剪贴板",
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background" />
        <div className="relative container mx-auto px-4 py-12 md:py-20">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2 rounded-full text-sm font-medium mb-6">
              <BookOpen className="h-4 w-4" />
              让 AI 读懂微信公众号
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-4">
              微信文章 AI 阅读器
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground mb-8">
              提取微信公众号内容，生成 AI 可访问的公开链接。<br />
              无需安装插件，支持任何设备。
            </p>
          </div>
        </div>
      </div>

      {/* Main Tool Section */}
      <div className="container mx-auto px-4 -mt-4 pb-16">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-lg border-2">
            <CardHeader>
              <CardTitle>添加文章</CardTitle>
              <CardDescription>
                选择一种方式将微信文章内容添加到平台
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="paste" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="paste" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    手动粘贴
                  </TabsTrigger>
                  <TabsTrigger value="bookmarklet" className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4" />
                    书签工具
                  </TabsTrigger>
                </TabsList>
                
                {/* 手动粘贴 Tab */}
                <TabsContent value="paste" className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      文章标题 <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="输入文章标题"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      作者
                    </label>
                    <Input
                      placeholder="输入作者名称（可选）"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      文章内容 <span className="text-destructive">*</span>
                    </label>
                    <Textarea
                      placeholder="粘贴文章正文内容..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="min-h-[200px]"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">
                      原文链接
                    </label>
                    <Input
                      type="url"
                      placeholder="粘贴微信文章链接（可选，用于溯源）"
                      value={sourceUrl}
                      onChange={(e) => setSourceUrl(e.target.value)}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleSubmitArticle} 
                    disabled={isSubmitting}
                    className="w-full h-12"
                  >
                    {isSubmitting ? (
                      "提交中..."
                    ) : (
                      <>
                        生成 AI 可读链接
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </>
                    )}
                  </Button>
                </TabsContent>
                
                {/* 书签工具 Tab */}
                <TabsContent value="bookmarklet" className="space-y-6">
                  <div className="bg-muted rounded-xl p-6">
                    <h3 className="font-semibold text-foreground mb-3">
                      📖 一键提取书签
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      在浏览器中添加此书签，打开微信文章后点击即可一键提取并保存内容。
                    </p>
                    
                    <div className="space-y-4">
                      <div className="bg-background rounded-lg p-4 border">
                        <p className="text-sm font-medium mb-2">使用步骤：</p>
                        <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                          <li>点击下方按钮复制书签代码</li>
                          <li>在浏览器中新建书签（Ctrl+D 或 Cmd+D）</li>
                          <li>将书签网址替换为复制的代码</li>
                          <li>打开微信公众号文章，点击该书签</li>
                        </ol>
                      </div>
                      
                      <Button 
                        onClick={copyBookmarklet}
                        variant={bookmarkletCopied ? "secondary" : "default"}
                        className="w-full h-12"
                      >
                        {bookmarkletCopied ? (
                          <>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            已复制书签代码
                          </>
                        ) : (
                          <>
                            <Copy className="mr-2 h-4 w-4" />
                            复制书签代码
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    <p>💡 提示：书签工具需要在电脑浏览器中使用</p>
                    <p>手机用户请使用"手动粘贴"方式</p>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-4 py-16 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">为什么选择我们？</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Zap className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>无需爬虫</CardTitle>
                <CardDescription>
                  利用您浏览器的合法访问权限提取内容，绕过反爬限制，100% 成功率
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>AI 可访问</CardTitle>
                <CardDescription>
                  生成的公开链接无反爬保护，ChatGPT、Claude 等 AI 工具可直接读取
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <Code className="h-6 w-6 text-primary" />
                </div>
                <CardTitle>全平台支持</CardTitle>
                <CardDescription>
                  手机、平板、电脑均可使用，无需安装任何插件或应用
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </div>

      {/* API Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-3xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Code className="h-5 w-5" />
                开发者 API
              </CardTitle>
              <CardDescription>
                生成的文章页面可被任何 AI 工具直接访问
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 font-mono text-sm">
                <div className="flex items-center justify-between gap-4">
                  <code className="text-foreground break-all">
                    GET {window.location.origin}/a/&#123;文章ID&#125;
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyApiExample}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="mt-4 text-sm text-muted-foreground">
                <p className="mb-2">
                  文章保存后会生成唯一的公开链接，例如：
                </p>
                <code className="bg-muted px-2 py-1 rounded text-xs">
                  {window.location.origin}/a/550e8400-e29b-41d4-a716-446655440000
                </code>
                <p className="mt-3">
                  此链接可直接分享给 ChatGPT、Claude、Perplexity 等 AI 工具阅读。
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Footer */}
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
