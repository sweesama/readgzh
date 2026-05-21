import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Sparkles, Loader2 } from "lucide-react";
import SEO from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const upgraded = params.get("upgraded") === "1";
  const [syncing, setSyncing] = useState(true);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      for (let attempt = 0; attempt < 4; attempt++) {
        const { data } = await supabase.functions.invoke("check-payment").catch(() => ({ data: null }));
        if (cancelled) return;
        if (data?.is_pro) {
          setSynced(true);
          setSyncing(false);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      if (!cancelled) setSyncing(false);
    };
    void sync();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <SEO
        title={upgraded ? "订阅升级成功 | ReadGZH" : "支付成功 | ReadGZH"}
        description="ReadGZH 订阅支付成功，账户将在几分钟内生效。"
        path="/payment-success"
        noindex
      />
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          {upgraded ? (
            <Sparkles className="h-16 w-16 text-primary mx-auto" />
          ) : (
            <CheckCircle className="h-16 w-16 text-primary mx-auto" />
          )}
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {upgraded ? "订阅升级成功 ✨" : "支付成功 🎉"}
            </h1>
            <p className="text-muted-foreground">
              {upgraded ? (
                <>
                  你的订阅已升级为新套餐。系统已按已用天数自动补差价（详见控制台「账单与订阅」中的最新发票），
                  没有重复扣款，新额度立即生效。
                </>
              ) : (
                <>感谢购买 ReadGZH Pro！你的账户将在几分钟内升级。</>
              )}
            </p>
            <p className="text-sm text-muted-foreground mt-3 px-3 py-2 rounded-md bg-muted/50 border border-border/60 inline-flex items-center justify-center gap-2">
              {syncing && <Loader2 className="h-4 w-4 animate-spin" />}
              {synced ? "账户额度已同步到账，可以直接去控制台使用。" : syncing ? "正在同步账户额度，请稍候…" : "账户额度通常会自动到账；若控制台暂未更新，请进入控制台刷新。"}
            </p>
          </div>
          <div className="space-y-3">
            <Button onClick={() => navigate("/dashboard")} className="w-full">
              前往控制台 <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
            <Button variant="ghost" onClick={() => navigate("/")} className="w-full">
              返回首页
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentSuccessPage;
