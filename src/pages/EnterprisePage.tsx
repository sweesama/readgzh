import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Building2, FileText, Loader2, CheckCircle2, Landmark, Receipt } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import Footer from "@/components/home/Footer";
import SEO from "@/components/SEO";

const CONTACT_EMAIL = "sweeyeah@hotmail.com";

const schema = z.object({
  company_name: z.string().trim().min(2, "请填写公司全称").max(200),
  contact_name: z.string().trim().min(1, "请填写联系人").max(100),
  email: z.string().trim().email("邮箱格式不正确").max(255),
  phone: z.string().trim().max(50).optional(),
  tax_id: z.string().trim().max(50).optional(),
  note: z.string().trim().max(2000).optional(),
});

const PLANS = [
  { value: "team", label: "团队版（3,000 积分/月）" },
  { value: "enterprise", label: "企业版（12,000 积分/月）" },
  { value: "flagship", label: "旗舰版（40,000 积分/月）" },
  { value: "custom", label: "还不确定 / 需要定制" },
];

const EnterprisePage = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    company_name: "",
    contact_name: "",
    email: "",
    phone: "",
    tax_id: "",
    note: "",
  });
  const [plan, setPlan] = useState("enterprise");
  const [billing, setBilling] = useState("annual");
  const [invoice, setInvoice] = useState("plain");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: "请检查填写内容",
        description: parsed.error.issues[0]?.message ?? "表单填写有误",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    const { data, error } = await supabase.functions.invoke("submit-enterprise-inquiry", {
      body: {
        company_name: parsed.data.company_name,
        contact_name: parsed.data.contact_name,
        email: parsed.data.email,
        phone: parsed.data.phone || null,
        tax_id: parsed.data.tax_id || null,
        note: parsed.data.note || null,
        plan,
        billing_cycle: billing,
        invoice_type: invoice,
      },
    });
    setSubmitting(false);
    if (error || !data?.success) {
      toast({
        title: "提交失败",
        description: `请稍后重试，或直接邮件联系 ${CONTACT_EMAIL}`,
        variant: "destructive",
      });
      return;
    }
    setDone(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="企业采购与发票 - 对公转账 / 电子普票 | ReadGZH"
        description="ReadGZH 企业版：团队共享积分池、对公转账、可开具电子增值税普通发票，支持年付与月付。提交需求后 1 个工作日内回复。"
        path="/enterprise"
        ogType="website"
      />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate("/pricing")} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" />返回定价
        </Button>

        <div className="text-center mb-10">
          <Badge variant="secondary" className="mb-3">企业采购</Badge>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">对公转账 · 可开发票 · 团队共享积分</h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            适合公司报销、团队共用一份额度、需要正规发票与订单确认书的场景。填写下面的信息，我们会在 1 个工作日内回复报价与付款信息。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          {[
            { icon: Landmark, title: "对公转账", desc: "银行转账、支付宝、微信均可，到账后手动开通账号" },
            { icon: Receipt, title: "电子普票", desc: "开具增值税电子普通发票，类目：信息技术服务*技术服务费" },
            { icon: FileText, title: "订单确认书", desc: "提供简版订单确认书，邮件确认即可生效，无需线下盖章" },
          ].map((f) => (
            <Card key={f.title}>
              <CardHeader className="pb-3">
                <f.icon className="h-7 w-7 text-primary mb-2" />
                <CardTitle className="text-base">{f.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              {done ? "我们已收到你的需求" : "填写采购需求"}
            </CardTitle>
            <CardDescription>
              {done
                ? "我们会尽快通过邮件与你联系，确认方案、付款账户与开票信息。"
                : "带 * 为必填项，其余留空也可以，后续沟通时再补充。"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {done ? (
              <div className="flex flex-col items-center text-center py-8 gap-4">
                <CheckCircle2 className="h-12 w-12 text-primary" />
                <p className="text-sm text-muted-foreground max-w-md">
                  如果超过 1 个工作日没有收到回复，请直接发邮件到{" "}
                  <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。
                </p>
                <Button variant="outline" onClick={() => navigate("/pricing")}>返回定价页</Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">公司全称 *</Label>
                    <Input id="company_name" value={form.company_name} onChange={set("company_name")} maxLength={200} placeholder="与开票抬头一致" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_id">纳税人识别号</Label>
                    <Input id="tax_id" value={form.tax_id} onChange={set("tax_id")} maxLength={50} placeholder="开票用，可稍后提供" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_name">联系人 *</Label>
                    <Input id="contact_name" value={form.contact_name} onChange={set("contact_name")} maxLength={100} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">邮箱 *</Label>
                    <Input id="email" type="email" value={form.email} onChange={set("email")} maxLength={255} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">电话 / 微信</Label>
                    <Input id="phone" value={form.phone} onChange={set("phone")} maxLength={50} />
                  </div>
                  <div className="space-y-2">
                    <Label>意向方案</Label>
                    <Select value={plan} onValueChange={setPlan}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {PLANS.map((p) => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>计费方式</Label>
                    <Select value={billing} onValueChange={setBilling}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="annual">年付（推荐，更便宜）</SelectItem>
                        <SelectItem value="monthly">月付</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>发票需求</Label>
                    <Select value={invoice} onValueChange={setInvoice}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="plain">电子增值税普通发票</SelectItem>
                        <SelectItem value="special">增值税专用发票（个案沟通）</SelectItem>
                        <SelectItem value="none">暂不需要发票</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">备注</Label>
                  <Textarea id="note" value={form.note} onChange={set("note")} maxLength={2000} rows={4} placeholder="例如：预计每月读取多少篇文章、是否需要订单确认书、期望开通时间等" />
                </div>
                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />提交中...</>) : "提交采购需求"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  提交即表示同意我们通过邮件与你联系。也可以直接写邮件到{" "}
                  <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>。
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <div className="mt-10 space-y-4">
          <h2 className="text-xl font-bold">企业采购常见问题</h2>
          {[
            {
              q: "能开什么发票？",
              a: "可以开具电子增值税普通发票（普票），开票类目为「信息技术服务*技术服务费」，付款到账后 3 个工作日内发送到你的邮箱。增值税专用发票需要个案沟通确认。",
            },
            {
              q: "为什么企业版比个人版贵？",
              a: "企业版包含对公转账、开票、订单确认书、团队共享积分池与优先支持，这些都是人工处理成本；同时开票本身也有税负成本，价格中已包含。",
            },
            {
              q: "积分是按人分配的吗？",
              a: "不是。企业版是团队共享的积分池，团队内任意成员使用同一份额度，不按坐席数收费，人多人少都不影响价格。",
            },
            {
              q: "付款后多久开通？",
              a: "确认到账后 1 个工作日内手动开通，开通后立即生效，积分按月自动刷新。",
            },
            {
              q: "可以先试用吗？",
              a: "可以。注册后每天可免费领取 30 积分做验证，或先买一份加量包小规模测试，确认满意再走企业采购。",
            },
          ].map(({ q, a }) => (
            <div key={q} className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">{q}</h3>
              <p className="text-sm text-muted-foreground">{a}</p>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default EnterprisePage;
