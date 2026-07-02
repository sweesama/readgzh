// Self-service refund: calculates usage-based refund amount, refunds via Stripe,
// cancels subscription, downgrades user to free, clears bonus credits.
// Constraints: within 14 days of subscription start, max 1 self-service refund/year.
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

const DAYS_14_MS = 14 * 24 * 60 * 60 * 1000;
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

interface RefundQuote {
  subscription_id: string;
  charge_id: string;
  payment_intent_id: string;
  original_amount: number; // minor units
  used_credits_this_period: number;
  monthly_quota: number;
  days_elapsed: number;
  days_in_period: number;
  usage_ratio: number; // 0..1
  full_months_elapsed: number; // for annual
  current_month_ratio: number; // for annual
  refund_amount: number; // minor units
  currency: string;
  interval: string;
  eligible: boolean;
  ineligible_reason?: string;
}

async function buildQuote(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  customerId: string,
): Promise<RefundQuote | { error: string; status: number }> {
  // Find the most recent active or canceling subscription
  const subs = await stripe.subscriptions.list({
    customer: customerId,
    status: "all",
    limit: 10,
  });

  const eligibleSub = subs.data
    .filter((s) => ["active", "trialing", "past_due"].includes(s.status))
    .sort((a, b) => b.created - a.created)[0];

  if (!eligibleSub) {
    return { error: "no_active_subscription", status: 404 };
  }

  const firstItem = eligibleSub.items.data[0];
  const interval = firstItem?.price?.recurring?.interval ?? "month";
  const unitAmount = firstItem?.price?.unit_amount ?? 0;
  const currency = firstItem?.price?.currency ?? "cny";

  // Stripe API 2025-04-30+ moved current_period_start/end from the subscription
  // root to each subscription item. Read from the item and fall back to the
  // (deprecated) root fields for older subscriptions.
  const subAny = eligibleSub as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const itemAny = firstItem as unknown as {
    current_period_start?: number;
    current_period_end?: number;
  };
  const currentPeriodStart = itemAny?.current_period_start ?? subAny.current_period_start ?? eligibleSub.start_date;
  const currentPeriodEnd = itemAny?.current_period_end ?? subAny.current_period_end ?? (eligibleSub.start_date + 30 * 24 * 60 * 60);

  // 14-day window applies to the MOST RECENT charge (subscription start OR latest renewal).
  const subStartMs = eligibleSub.start_date * 1000;
  const periodStartMsForWindow = currentPeriodStart * 1000;
  const now = Date.now();
  const msSinceLatestCharge = Math.min(
    now - subStartMs,
    now - periodStartMsForWindow,
  );
  if (msSinceLatestCharge > DAYS_14_MS) {
    return { error: "refund_window_expired", status: 400 };
  }


  // Find the latest charge associated with this subscription via latest invoice
  let chargeId: string | null = null;
  let paymentIntentId: string | null = null;
  let originalAmount = unitAmount;

  const latestInvoiceId = typeof eligibleSub.latest_invoice === "string"
    ? eligibleSub.latest_invoice
    : eligibleSub.latest_invoice?.id;
  if (latestInvoiceId) {
    const invoice = await stripe.invoices.retrieve(latestInvoiceId);
    if (invoice.charge) {
      chargeId = typeof invoice.charge === "string" ? invoice.charge : invoice.charge.id;
    }
    if (invoice.payment_intent) {
      paymentIntentId = typeof invoice.payment_intent === "string"
        ? invoice.payment_intent
        : invoice.payment_intent.id;
    }
    originalAmount = invoice.amount_paid || unitAmount;
  }

  if (!chargeId) {
    return { error: "no_charge_found", status: 400 };
  }

  // Check whether this charge is already refunded
  const existingRefunds = await stripe.refunds.list({ charge: chargeId, limit: 5 });
  if (existingRefunds.data.length > 0) {
    return { error: "already_refunded", status: 400 };
  }

  // Check 1-refund-per-year limit
  const oneYearAgo = new Date(now - ONE_YEAR_MS).toISOString();
  const { data: previousRefunds, error: refundQueryError } = await supabase
    .from("refund_records")
    .select("id")
    .eq("user_id", userId)
    .eq("refund_type", "self_service")
    .gte("created_at", oneYearAgo)
    .limit(1);
  if (refundQueryError) {
    console.error("Refund history query error:", refundQueryError);
  }
  if (previousRefunds && previousRefunds.length > 0) {
    return { error: "refund_yearly_limit", status: 400 };
  }

  // Determine monthly quota: assume Pro 2000, Lite check by price metadata.
  // Read from api_keys daily_limit (already represents monthly quota for paid tiers).
  const { data: keyRow } = await supabase
    .from("api_keys")
    .select("daily_limit")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("daily_limit", { ascending: false })
    .limit(1)
    .maybeSingle();
  const monthlyQuota = keyRow?.daily_limit ?? 2000;

  // Usage in the current Stripe billing period
  const periodStart = new Date(eligibleSub.current_period_start * 1000)
    .toISOString()
    .slice(0, 10);
  const { data: usageRows } = await supabase
    .from("api_usage")
    .select("request_count, api_keys!inner(user_id)")
    .gte("usage_date", periodStart)
    .eq("api_keys.user_id", userId);
  const usedCredits = (usageRows ?? []).reduce(
    (sum: number, r: { request_count: number }) => sum + (r.request_count ?? 0),
    0,
  );

  const periodStartMs = eligibleSub.current_period_start * 1000;
  const periodEndMs = eligibleSub.current_period_end * 1000;
  const daysInPeriod = Math.max(1, Math.round((periodEndMs - periodStartMs) / (24 * 60 * 60 * 1000)));
  const daysElapsed = Math.max(0, (now - periodStartMs) / (24 * 60 * 60 * 1000));

  let refundAmount = 0;
  let usageRatio = 0;
  let fullMonthsElapsed = 0;
  let currentMonthRatio = 0;

  if (interval === "year") {
    // Annual: deduct full elapsed months at monthly rate, plus partial current month.
    // Use ¥24.9/month as the equivalent monthly rate for annual (299/12 ≈ 24.92).
    const monthlyEquivalent = Math.round(originalAmount / 12);
    // Months elapsed since sub start
    const monthsElapsedExact =
      (now - subStartMs) / (1000 * 60 * 60 * 24 * 30); // approx month
    fullMonthsElapsed = Math.floor(monthsElapsedExact);
    const daysIntoCurrentMonth = (monthsElapsedExact - fullMonthsElapsed) * 30;
    const usageRatioCurrentMonth = usedCredits / Math.max(1, monthlyQuota);
    currentMonthRatio = Math.min(1, Math.max(daysIntoCurrentMonth / 30, usageRatioCurrentMonth));
    const deduction = fullMonthsElapsed * monthlyEquivalent + Math.round(currentMonthRatio * monthlyEquivalent);
    refundAmount = Math.max(0, originalAmount - deduction);
    usageRatio = usageRatioCurrentMonth;
  } else {
    // Monthly: refund = original × (1 - max(daysElapsed/daysInPeriod, used/quota))
    const usageRatioRaw = usedCredits / Math.max(1, monthlyQuota);
    const ratio = Math.min(1, Math.max(daysElapsed / daysInPeriod, usageRatioRaw));
    refundAmount = Math.max(0, Math.round(originalAmount * (1 - ratio)));
    usageRatio = usageRatioRaw;
  }

  return {
    subscription_id: eligibleSub.id,
    charge_id: chargeId,
    payment_intent_id: paymentIntentId ?? "",
    original_amount: originalAmount,
    used_credits_this_period: usedCredits,
    monthly_quota: monthlyQuota,
    days_elapsed: Math.round(daysElapsed * 10) / 10,
    days_in_period: daysInPeriod,
    usage_ratio: Math.round(usageRatio * 1000) / 1000,
    full_months_elapsed: fullMonthsElapsed,
    current_month_ratio: Math.round(currentMonthRatio * 1000) / 1000,
    refund_amount: refundAmount,
    currency,
    interval,
    eligible: true,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user?.email) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const action = body.action || "quote"; // "quote" or "confirm"

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    if (customers.data.length === 0) return json({ error: "no_billing_account" }, 404);
    const customerId = customers.data[0].id;

    const quote = await buildQuote(stripe, supabase, user.id, customerId);
    if ("error" in quote) return json({ error: quote.error }, quote.status);

    if (action === "quote") {
      return json({ quote });
    }

    if (action !== "confirm") return json({ error: "invalid_action" }, 400);

    // Execute refund
    if (quote.refund_amount <= 0) {
      // Even with zero refund amount, still cancel the subscription so the user
      // is fully off the paid plan.
      try {
        await stripe.subscriptions.cancel(quote.subscription_id);
      } catch (e) {
        console.error("Cancel sub failed (zero refund path):", e);
      }
      return json({ refunded: false, reason: "zero_amount", quote });
    }

    const refund = await stripe.refunds.create({
      charge: quote.charge_id,
      amount: quote.refund_amount,
      reason: "requested_by_customer",
      metadata: {
        user_id: user.id,
        subscription_id: quote.subscription_id,
        refund_type: "self_service",
      },
    });

    // Cancel subscription immediately
    try {
      await stripe.subscriptions.cancel(quote.subscription_id);
    } catch (e) {
      console.error("Cancel sub failed:", e);
    }

    // Downgrade user: api_keys -> free tier, clear bonus
    await supabase
      .from("api_keys")
      .update({
        tier: "free",
        daily_limit: 30,
        bonus_credits: 0,
        bonus_expires_at: null,
      })
      .eq("user_id", user.id)
      .eq("is_active", true);

    // Record the refund (idempotent on stripe_refund_id)
    await supabase.from("refund_records").insert({
      user_id: user.id,
      stripe_charge_id: quote.charge_id,
      stripe_payment_intent_id: quote.payment_intent_id || null,
      stripe_refund_id: refund.id,
      stripe_subscription_id: quote.subscription_id,
      amount_refunded: quote.refund_amount,
      currency: quote.currency,
      original_amount: quote.original_amount,
      refund_type: "self_service",
      reason: body.reason || null,
      formula_breakdown: {
        interval: quote.interval,
        used_credits: quote.used_credits_this_period,
        monthly_quota: quote.monthly_quota,
        days_elapsed: quote.days_elapsed,
        days_in_period: quote.days_in_period,
        usage_ratio: quote.usage_ratio,
        full_months_elapsed: quote.full_months_elapsed,
        current_month_ratio: quote.current_month_ratio,
      },
    });

    return json({
      refunded: true,
      refund_id: refund.id,
      amount_refunded: quote.refund_amount,
      currency: quote.currency,
      quote,
    });
  } catch (error) {
    console.error("request-refund error:", error);
    return json(
      { error: "Internal server error. Please try again later." },
      500,
    );
  }
});
