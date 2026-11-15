import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { sendTemplateEmail } from "../_shared/transactional-email-templates/send-email.ts";

// Admin-only: sends one of a fixed set of support replies, each to its own fixed recipient.
const REPLIES: Record<string, { to: string; title: string; greeting: string; content: string }> = {
  "topup-20261112": {
    to: "absoluteratking@gmail.com",
    title: "关于您充值积分的说明和道歉",
    greeting: "您好！",
    content: `我是 ReadGZH 的开发者。非常抱歉，您刚充完钱就看到"积分不足"，让您担心了。

我已经帮您查过：您付款买的 500 积分已经全部到账，还没有用过。

出问题的原因是：您的账户还没创建"API Key"。系统靠它来认出是您。没有它，系统就把您当成没登录的访客，访客每天只能用 10 次，所以弹出了"积分不足"。

解决办法很简单：
1. 打开 readgzh.site/dashboard 并登录；
2. 点"创建 API Key"；
3. 刷新页面，之后就能正常使用了。

有任何问题，直接回这封邮件，或者发邮件到 sweeyeah@hotmail.com，我会亲自回复。再次说声对不起！`,
  },
  "packrefund-20261115": {
    to: "absoluteratking@gmail.com",
    title: "关于您的 ¥9 加量包退款已原路退回通知",
    greeting: "您好！",
    content: `我是 ReadGZH 的开发者。非常抱歉，前一封邮件可能因为邮箱网络问题没能成功送达。

您申请退订的 ¥9 加量包（500 积分），因为您还没有开始使用，已经为您办理全额原路退款。款项通常会在 1-3 个工作日内退回到您原来的支付渠道（支付宝），请注意查收。

同时请您放心：您的 Lite 月度会员权益完全保留，本月剩余的 240 积分不受任何影响，您可以继续正常使用。

如果您在使用中遇到任何问题或有其他建议，直接回复这封邮件即可。再次感谢您的理解与支持！`,
  },
  "refund-20261109": {
    to: "t28mojun@qq.com",
    title: "给您的道歉，和一份补偿",
    greeting: "您好！",
    content: `我是 ReadGZH 的开发者。看到您退款时写的话，我真的很抱歉，给您带来了这么糟糕的体验。

我把原因跟您说清楚：

一、您刚开通会员，页面上就显示"已经用了 1700 多积分"。这是我们页面算错了，把您开通会员前试用的记录也算进了会员额度。其实您的会员额度当时一点都没用，是显示错了，并没有人偷用。

二、您点"联系我们"没反应。那个按钮只能打开电脑里装好的邮箱软件，没装的话点了就没动静。您着急找我们的时候却找不到人，是我们做得不好。

再次跟您说一声对不起！这两个问题现在都已经改好了。

以后有任何问题，您都可以直接发邮件到 sweeyeah@hotmail.com，我会亲自回复。

为了补偿你，如果你愿意的话，可以点击这个链接，获得一个月免费会员的资格：
https://readgzh.site/claim-pro?token=7UMA-5UFtZnZO19o61o3CU7W
（用 t28mojun@qq.com 这个邮箱登录后点链接就能领。不用付钱，也不用绑卡。如果还没登录，先登录，再点一次这个链接就行。）

谢谢您当初愿意试用我们，祝您一切顺利！`,
  },
};

const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const svc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  const { data: u } = jwt ? await svc.auth.getUser(jwt) : { data: null };
  if (!u?.user) return json({ error: "unauthorized" }, 401);
  const { data: isAdmin } = await svc.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
  if (!isAdmin) return json({ error: "forbidden" }, 403);
  const { id } = await req.json().catch(() => ({}));
  const r = REPLIES[id];
  if (!r) return json({ error: "unknown_reply" }, 400);
  const res = await sendTemplateEmail("system-notice", r.to, {
    templateData: { title: r.title, greeting: r.greeting, content: r.content },
    idempotencyKey: `support-reply-${id}`,
    replyTo: "sweeyeah@hotmail.com",
  });
  return json(res);
});
