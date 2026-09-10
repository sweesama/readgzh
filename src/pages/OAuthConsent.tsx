import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ShieldCheck } from "lucide-react";

type AuthorizationDetails = {
  client?: { name?: string | null } | null;
  redirect_url?: string | null;
  redirect_to?: string | null;
};

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
};

function oauthApi(): OAuthNamespace {
  return (supabase.auth as unknown as { oauth: OAuthNamespace }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const { toast } = useToast();
  const authorizationId = params.get("authorization_id") ?? "";
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const consentUrl = typeof window === "undefined" ? "" : window.location.href;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("缺少 authorization_id 参数，请从客户端重新发起连接。");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!active) return;
      if (!sess.session) {
        setSignedIn(false);
        return;
      }
      setSignedIn(true);
      const { data, error: detailError } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (detailError) {
        setError(detailError.message);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId, signedIn]);

  const decide = async (approve: boolean) => {
    setBusy(true);
    const api = oauthApi();
    const { data, error: decisionError } = approve
      ? await api.approveAuthorization(authorizationId)
      : await api.denyAuthorization(authorizationId);
    if (decisionError) {
      setBusy(false);
      setError(decisionError.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("授权服务器没有返回跳转地址，请重试。");
      return;
    }
    window.location.href = target;
  };

  const signInWithGoogle = async () => {
    const { error: loginError } = await lovable.auth.signInWithOAuth("google", { redirect_uri: consentUrl });
    if (loginError) toast({ title: "登录失败", description: String(loginError), variant: "destructive" });
  };

  const sendOtp = async () => {
    if (!email) return toast({ title: "请输入邮箱地址", variant: "destructive" });
    setBusy(true);
    const { error: otpError } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    setBusy(false);
    if (otpError) return toast({ title: "发送失败", description: otpError.message, variant: "destructive" });
    setOtpSent(true);
    toast({ title: "验证码已发送", description: "请查收邮箱中的 8 位验证码" });
  };

  const verifyOtp = async () => {
    setBusy(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: otp.trim(), type: "email" });
    setBusy(false);
    if (verifyError) return toast({ title: "验证失败", description: verifyError.message, variant: "destructive" });
    setSignedIn(true);
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-semibold text-foreground">连接到 ReadGZH</h1>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!error && signedIn === null && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 加载中…
          </p>
        )}

        {!error && signedIn === false && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">请先登录 ReadGZH 账号，才能授权应用以你的身份读取文章。</p>
            <Button className="w-full" variant="outline" onClick={signInWithGoogle}>
              使用 Google 登录
            </Button>
            <div className="space-y-2">
              <Input placeholder="邮箱地址" value={email} onChange={(e) => setEmail(e.target.value)} />
              {otpSent && (
                <Input placeholder="邮箱验证码" value={otp} onChange={(e) => setOtp(e.target.value)} />
              )}
              <Button className="w-full" disabled={busy} onClick={otpSent ? verifyOtp : sendOtp}>
                {busy ? "处理中…" : otpSent ? "验证并继续" : "发送邮箱验证码"}
              </Button>
            </div>
          </div>
        )}

        {!error && signedIn && !details && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> 正在读取授权请求…
          </p>
        )}

        {!error && signedIn && details && (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{details.client?.name ?? "该应用"}</span>{" "}
              请求以你的身份使用 ReadGZH：读取微信公众号文章、搜索已缓存文章。抓取新文章会消耗你账号的积分。
            </p>
            <div className="flex gap-3">
              <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                同意授权
              </Button>
              <Button className="flex-1" variant="outline" disabled={busy} onClick={() => decide(false)}>
                拒绝
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
