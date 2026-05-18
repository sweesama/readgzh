import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user?.email) return json({ error: "Unauthorized" }, 401);

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({
      email: userData.user.email!,
      limit: 1,
    });

    if (customers.data.length === 0) {
      return json({
        has_account: false,
        invoices: [],
        subscriptions: [],
        refunds: [],
      });
    }

    const customerId = customers.data[0].id;

    // Fetch in parallel
    const [invoicesRes, subsRes, chargesRes] = await Promise.all([
      stripe.invoices.list({ customer: customerId, limit: 20 }),
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 }),
      stripe.charges.list({ customer: customerId, limit: 30 }),
    ]);

    const invoices = invoicesRes.data.map((inv) => ({
      id: inv.id,
      number: inv.number,
      status: inv.status,
      amount_paid: inv.amount_paid,
      currency: inv.currency,
      created: inv.created,
      hosted_invoice_url: inv.hosted_invoice_url,
      invoice_pdf: inv.invoice_pdf,
      description:
        inv.lines?.data?.[0]?.description ??
        inv.lines?.data?.[0]?.price?.nickname ??
        null,
    }));

    const subscriptions = subsRes.data.map((sub) => ({
      id: sub.id,
      status: sub.status,
      cancel_at_period_end: sub.cancel_at_period_end,
      current_period_end: sub.current_period_end,
      current_period_start: sub.current_period_start,
      interval: sub.items.data[0]?.price?.recurring?.interval ?? null,
      amount: sub.items.data[0]?.price?.unit_amount ?? null,
      currency: sub.items.data[0]?.price?.currency ?? null,
      nickname: sub.items.data[0]?.price?.nickname ?? null,
    }));

    // Collect refunds from charges
    const refunds: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string | null;
      reason: string | null;
      created: number;
      charge_id: string;
    }> = [];
    for (const ch of chargesRes.data) {
      if (ch.refunds?.data?.length) {
        for (const r of ch.refunds.data) {
          refunds.push({
            id: r.id,
            amount: r.amount,
            currency: r.currency,
            status: r.status,
            reason: r.reason,
            created: r.created,
            charge_id: ch.id,
          });
        }
      }
    }
    refunds.sort((a, b) => b.created - a.created);

    return json({
      has_account: true,
      invoices,
      subscriptions,
      refunds,
    });
  } catch (error) {
    console.error("billing-history error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Internal error" },
      500
    );
  }
});
