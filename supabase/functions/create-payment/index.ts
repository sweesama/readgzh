import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const user = userData.user;
    const body = await req.json().catch(() => ({}));
    const type = body.type || "pro"; // "pro", "pro_annual", "credits", or "credits_free"

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    // Ensure Stripe customer exists
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const newCustomer = await stripe.customers.create({
        email: user.email!,
        metadata: { supabase_user_id: user.id },
      });
      customerId = newCustomer.id;
    }

    const origin = req.headers.get("origin") || "https://readgzh.lovable.app";

    let priceId: string;
    let successUrl: string;
    let mode: "payment" | "subscription";

    if (type === "credits") {
      priceId = "price_1T7tEZB04cx1cwwsvtQBDXY5"; // 500 credits ¥9 one-time
      successUrl = `${origin}/dashboard?credits_purchased=500`;
      mode = "payment";
    } else if (type === "pro_annual") {
      priceId = "price_1T8HM0B04cx1cwwsLAt6soQv"; // Pro annual ¥299/year
      successUrl = `${origin}/payment-success`;
      mode = "subscription";
    } else {
      priceId = "price_1T8HLSB04cx1cwwsbsxlb9JG"; // Pro monthly ¥39/month
      successUrl = `${origin}/payment-success`;
      mode = "subscription";
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: successUrl,
      cancel_url: `${origin}/pricing`,
      metadata: { user_id: user.id, type },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Payment error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
