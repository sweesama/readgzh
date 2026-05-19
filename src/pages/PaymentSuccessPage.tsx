import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight, Sparkles } from "lucide-react";
import SEO from "@/components/SEO";

const PaymentSuccessPage = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const upgraded = params.get("upgraded") === "1";

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
            <p className="text-sm text-muted-foreground mt-3 px-3 py-2 rounded-md bg-muted/50 border border-border/60">
              账户额度通常在 1–2 分钟内到账。若控制台暂未更新，请稍候刷新；如仍有问题，欢迎在留言板联系我们。
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
