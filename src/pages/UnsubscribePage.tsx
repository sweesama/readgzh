import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, MailX } from "lucide-react";
import SEO from "@/components/SEO";

const UnsubscribePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "valid" | "already" | "invalid" | "success" | "error">("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      setStatus(data?.success ? "success" : "error");
    } catch {
      setStatus("error");
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <SEO
        title="邮件退订 | ReadGZH"
        description="退订 ReadGZH 通知邮件。确认后您将不再收到来自 ReadGZH 的通知邮件。"
        path="/unsubscribe"
        noindex
      />
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <MailX className="h-10 w-10 mx-auto mb-2 text-muted-foreground" />
          <h1 className="text-2xl font-semibold leading-none tracking-tight">邮件退订</h1>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />验证中...
            </div>
          )}
          {status === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">确认退订后，你将不再收到来自 ReadGZH 的通知邮件。</p>
              <Button onClick={handleUnsubscribe} disabled={processing} variant="destructive">
                {processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />处理中...</> : "确认退订"}
              </Button>
            </>
          )}
          {status === "success" && (
            <div className="flex flex-col items-center gap-2 text-green-600">
              <CheckCircle className="h-8 w-8" />
              <p className="font-medium">已成功退订</p>
              <p className="text-sm text-muted-foreground">你将不再收到通知邮件。</p>
            </div>
          )}
          {status === "already" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">此邮箱已退订，无需重复操作。</p>
            </div>
          )}
          {(status === "invalid" || status === "error") && (
            <div className="flex flex-col items-center gap-2 text-destructive">
              <XCircle className="h-8 w-8" />
              <p className="text-sm">链接无效或已过期。</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UnsubscribePage;
