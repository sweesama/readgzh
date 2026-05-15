import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, ArrowRight } from "lucide-react";
import SEO from "@/components/SEO";

const PaymentSuccessPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <SEO title="支付成功 | ReadGZH" description="ReadGZH 订阅支付成功，账户将在几分钟内升级。" path="/payment-success" noindex />
      <Card className="max-w-md w-full text-center">
        <CardContent className="pt-10 pb-8 space-y-6">
          <CheckCircle className="h-16 w-16 text-primary mx-auto" />
          <div>
            <h1 className="text-2xl font-bold mb-2">支付成功 🎉</h1>
            <p className="text-muted-foreground">
              感谢购买 ReadGZH Pro！你的账户将在几分钟内升级。
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
