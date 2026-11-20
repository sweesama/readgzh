import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Crown, Loader2 } from "lucide-react";

const ERRORS: Record<string, string> = {
  invalid_token: "这个领取链接无效，请检查链接是否完整。",
  already_claimed: "这个链接已经领取过了，会员已在你的账户里。",
  wrong_account: "请用收到邮件的那个邮箱账号登录后再领取。",
  login_required: "请先登录再领取。",
};

const ClaimProPage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"idle" | "working" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (token) sessionStorage.setItem("claim_pro_token", token);
  }, [token]);

  const claim = async () => {
    setStatus("working");
    const { data, error } = await supabase.functions.invoke("claim-comp", { body: { token } });
    let code = (data as { error?: string } | null)?.error;
    if (error) {
      try {
        const ctx = (error as { context?: Response }).context;
        const b = ctx ? await ctx.json() : null;
        code = b?.error || code;
        if (code === "wrong_account" && b?.hint) {
          setStatus("error");
          setMsg(`${ERRORS.wrong_account}（${b.hint}）`);
          return;
        }
      } catch { /* ignore */ }
    }
    if (error || code) {
      setStatus("error");
      setMsg(ERRORS[code || ""] || "领取失败，请稍后再试，或发邮件到 sweeyeah@hotmail.com。");
      return;
    }
    setStatus("done");
    const exp = new Date((data as { expires_at: string }).expires_at).toLocaleDateString("zh-CN");
    setMsg(`领取成功！你的会员有效期到 ${exp}，每月 2000 积分。`);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <Helmet>
        <title>领取免费会员 | ReadGZH</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="max-w-md w-full rounded-xl border bg-card p-8 text-center space-y-5">
        <Crown className="h-10 w-10 text-primary mx-auto" />
        <h1 className="text-xl font-semibold text-foreground">领取一个月免费会员</h1>
        {!token ? (
          <p className="text-sm text-muted-foreground">{ERRORS.invalid_token}</p>
        ) : loading ? (
          <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
        ) : !user ? (
          <>
            <p className="text-sm text-muted-foreground">请先用收到邮件的邮箱登录。登录后会自动回到这里。</p>
            <Button asChild><Link to={`/dashboard?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`}>去登录</Link></Button>
          </>
        ) : status === "done" ? (
          <>
            <p className="text-sm text-foreground">{msg}</p>
            <Button asChild><Link to="/dashboard">去控制台</Link></Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">不用付钱，也不用绑卡。点一下就开通 30 天会员。</p>
            <Button onClick={claim} disabled={status === "working"}>
              {status === "working" && <Loader2 className="h-4 w-4 animate-spin mr-1" />}立即领取
            </Button>
            {status === "error" && <p className="text-sm text-destructive">{msg}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default ClaimProPage;
