import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Quote {
  subscription_id: string;
  original_amount: number;
  used_credits_this_period: number;
  monthly_quota: number;
  days_elapsed: number;
  days_in_period: number;
  full_months_elapsed: number;
  current_month_ratio: number;
  refund_amount: number;
  currency: string;
  interval: string;
}

const errorMap: Record<string, string> = {
  no_active_subscription: "未找到有效订阅",
  refund_window_expired: "已超过 14 天退款窗口",
  refund_yearly_limit: "您一年内只能自助退款一次，请联系客服",
  no_charge_found: "未找到对应的支付记录，请联系客服",
  already_refunded: "该订单已退款",
  no_billing_account: "未找到账单记录",
  Unauthorized: "请先登录",
};

const formatMoney = (amount: number, currency: string) => {
  const upper = (currency || "cny").toUpperCase();
  const symbol = upper === "CNY" ? "¥" : upper === "USD" ? "$" : `${upper} `;
  return `${symbol}${(amount / 100).toFixed(2)}`;
};

const getFunctionErrorCode = async (error: unknown, data?: unknown) => {
  const structuredCode = (data as { error?: string } | null)?.error;
  if (structuredCode) return structuredCode;

  const response = (error as { context?: Response })?.context;
  if (response) {
    try {
      const payload = await response.clone().json();
      if (payload?.error) return String(payload.error);
    } catch {
      // Fall through to the generic message below.
    }
  }

  return error instanceof Error ? error.message : "unknown";
};

interface Props {
  onRefunded?: () => void;
}

const RefundRequestDialog = ({ onRefunded }: Props) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const fetchQuote = async () => {
    setLoading(true);
    setErrorCode(null);
    setQuote(null);
    try {
      const { data, error } = await supabase.functions.invoke("request-refund", {
        body: { action: "quote" },
      });
      if (error) {
        setErrorCode(await getFunctionErrorCode(error, data));
        return;
      }
      if ((data as { error?: string })?.error) {
        setErrorCode((data as { error?: string }).error!);
        return;
      }
      setQuote((data as { quote: Quote }).quote);
    } catch (e) {
      setErrorCode(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      fetchQuote();
    } else {
      setQuote(null);
      setErrorCode(null);
      setReason("");
    }
  };

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("request-refund", {
        body: { action: "confirm", reason },
      });
      if (error) throw new Error(await getFunctionErrorCode(error, data));
      const result = data as { refunded: boolean; amount_refunded?: number; currency?: string; reason?: string };
      if (result.refunded) {
        toast({
          title: "退款成功",
          description: `已退款 ${formatMoney(result.amount_refunded || 0, result.currency || "cny")}，订阅已取消`,
        });
      } else {
        toast({
          title: "订阅已取消",
          description: "本次退款金额为 0，订阅已取消",
        });
      }
      setOpen(false);
      onRefunded?.();
    } catch (e) {
      toast({
        title: "退款失败",
        description: e instanceof Error ? e.message : String(e),
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
          <RotateCcw className="h-3.5 w-3.5 mr-1" /> 申请退款
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>申请退款</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-sm">
              {loading && (
                <div className="flex items-center text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin mr-2" /> 正在计算退款金额…
                </div>
              )}
              {errorCode && (
                <div className="text-destructive">
                  {errorMap[errorCode] || `退款不可用：${errorCode}`}
                </div>
              )}
              {quote && (
                <div className="space-y-2">
                  <p>
                    根据您的使用情况，可退款金额为
                    <span className="font-semibold text-foreground text-base mx-1">
                      {formatMoney(quote.refund_amount, quote.currency)}
                    </span>
                    / 原支付 {formatMoney(quote.original_amount, quote.currency)}
                  </p>
                  <div className="bg-muted/50 rounded-md p-3 text-xs space-y-1 text-muted-foreground">
                    <p>套餐：{quote.interval === "year" ? "Pro 年付" : "Pro 月付"}</p>
                    <p>本周期已用积分：{quote.used_credits_this_period} / 月额度 {quote.monthly_quota}</p>
                    {quote.interval === "year" ? (
                      <p>
                        已完整使用 {quote.full_months_elapsed} 个月 + 当月用量 {(quote.current_month_ratio * 100).toFixed(0)}%
                      </p>
                    ) : (
                      <p>本周期已过 {quote.days_elapsed.toFixed(1)} / {quote.days_in_period} 天</p>
                    )}
                  </div>
                  <ul className="text-xs text-muted-foreground list-disc pl-5 space-y-1">
                    <li>退款后会立即取消订阅，账号降级为免费版</li>
                    <li>未使用的加量包积分会一并清空</li>
                    <li>每位用户一年内只能自助退款 1 次</li>
                  </ul>
                  <Textarea
                    placeholder="（可选）请简单说明退款原因，帮我们改进产品"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={submitting}>取消</AlertDialogCancel>
          {quote && (
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={submitting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              确认退款
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RefundRequestDialog;
