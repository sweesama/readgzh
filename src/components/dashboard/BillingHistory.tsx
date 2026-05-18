import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Receipt, ExternalLink, RotateCcw } from "lucide-react";
import RefundRequestDialog from "./RefundRequestDialog";

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  amount_paid: number;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
}

interface Subscription {
  id: string;
  status: string;
  cancel_at_period_end: boolean;
  current_period_end: number;
  current_period_start: number;
  interval: string | null;
  amount: number | null;
  currency: string | null;
  nickname: string | null;
}

interface Refund {
  id: string;
  amount: number;
  currency: string;
  status: string | null;
  reason: string | null;
  created: number;
  charge_id: string;
}

interface BillingData {
  has_account: boolean;
  invoices: Invoice[];
  subscriptions: Subscription[];
  refunds: Refund[];
}

const formatMoney = (amount: number, currency: string) => {
  const value = amount / 100;
  const upper = (currency || "cny").toUpperCase();
  const symbol = upper === "CNY" ? "¥" : upper === "USD" ? "$" : `${upper} `;
  return `${symbol}${value.toFixed(2)}`;
};

const formatDate = (unix: number) =>
  new Date(unix * 1000).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

const statusLabel: Record<string, string> = {
  paid: "已支付",
  open: "待支付",
  void: "已作废",
  uncollectible: "未收回",
  draft: "草稿",
  active: "进行中",
  canceled: "已取消",
  trialing: "试用中",
  past_due: "已过期",
  incomplete: "未完成",
  incomplete_expired: "已过期",
  unpaid: "未付款",
  succeeded: "已退款",
  pending: "处理中",
  failed: "失败",
};

const BillingHistory = () => {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("billing-history");
      if (err) throw err;
      setData(res as BillingData);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> 账单与订阅</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin mr-2" /> 正在加载账单记录…
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> 账单与订阅</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">加载失败：{error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!data?.has_account) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> 账单与订阅</CardTitle>
          <CardDescription>暂无支付记录</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">完成首次订阅或购买加量包后，账单和发票会在这里显示。</p>
        </CardContent>
      </Card>
    );
  }

  const { invoices, subscriptions, refunds } = data;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Receipt className="h-5 w-5" /> 账单与订阅</CardTitle>
        <CardDescription>查看您的订阅状态、历史发票和退款记录</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Subscriptions */}
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">订阅</h3>
          {subscriptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无订阅记录</p>
          ) : (
            <div className="space-y-2">
              {subscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between p-3 rounded-md border bg-muted/30 flex-wrap gap-2">
                  <div className="flex items-center gap-3">
                    <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                      {statusLabel[sub.status] ?? sub.status}
                    </Badge>
                    <div>
                      <p className="text-sm font-medium">
                        {sub.interval === "year" ? "Pro 年付" : sub.interval === "month" ? "Pro 月付" : (sub.nickname ?? "订阅")}
                        {sub.amount != null && sub.currency && (
                          <span className="text-muted-foreground font-normal ml-2">
                            {formatMoney(sub.amount, sub.currency)}/{sub.interval === "year" ? "年" : "月"}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sub.cancel_at_period_end ? "已取消，有效至 " : "下次续费 "}
                        {formatDate(sub.current_period_end)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Invoices */}
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground">发票记录</h3>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无发票</p>
          ) : (
            <div className="space-y-1">
              {invoices.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 flex-wrap gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {inv.description || inv.number || "发票"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(inv.created)} · {formatMoney(inv.amount_paid, inv.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={inv.status === "paid" ? "default" : "secondary"} className="text-xs">
                      {statusLabel[inv.status ?? ""] ?? inv.status}
                    </Badge>
                    {inv.hosted_invoice_url && (
                      <Button variant="ghost" size="sm" asChild>
                        <a href={inv.hosted_invoice_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Refunds */}
        <div>
          <h3 className="text-sm font-semibold mb-2 text-muted-foreground flex items-center gap-1">
            <RotateCcw className="h-3.5 w-3.5" /> 退款记录
          </h3>
          {refunds.length === 0 ? (
            <p className="text-sm text-muted-foreground">暂无退款</p>
          ) : (
            <div className="space-y-1">
              {refunds.map((r) => (
                <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">{formatMoney(r.amount, r.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(r.created)}
                      {r.reason && ` · ${r.reason}`}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {statusLabel[r.status ?? ""] ?? r.status ?? "—"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default BillingHistory;
