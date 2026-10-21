import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import SEO from "@/components/SEO";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <SEO
        title="页面不存在 | ReadGZH"
        description="这个地址没有对应的 ReadGZH 页面。"
        path={location.pathname || "/404"}
        noindex
      />
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold">页面不存在</h1>
        <p className="mb-4 text-xl text-muted-foreground">没有找到这个地址。</p>
        <a href="/" className="text-primary underline hover:text-primary/90">
          返回首页
        </a>
      </div>
    </div>
  );
};

export default NotFound;
