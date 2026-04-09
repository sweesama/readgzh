import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2025-08-27.basil",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

const log = (step: string, details?: any) => {
  console.log(`[stripe-webhook] ${step}`, details ? JSON.stringify(details) : "");
};

// Stripe product → tier mapping (same as check-payment)
const PRODUCT_TIER_MAP: Record<string, { tier: string; limit: number }> = {
  "prod_UIWlK0eiiBL1gd": { tier: "lite", limit: 300 },
  "prod_U6UKPXDtv2SFEP": { tier: "pro", limit: 2000 },
  "prod_U6UKSXOZfSMSpB": { tier: "pro", limit: 2000 },
};

async function getUserIdByEmail(email: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

async function syncSubscriptionTier(customerId: string) {
  // Get customer email
  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as any).deleted || !(customer as Stripe.Customer).email) {
    log("Customer deleted or no email", { customerId });
    return;
  }
  const email = (customer as Stripe.Customer).email!;
  const userId = await getUserIdByEmail(email);
  if (!userId) {
    log("No user found for email", { email });
    return;
  }

  log("Syncing subscription for user", { userId, email });

  // Check active subscriptions
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 5,
  });

  if (subscriptions.data.length > 0) {
    const sub = subscriptions.data[0];
    const productId = sub.items.data[0]?.price?.product as string;
    const tierInfo = PRODUCT_TIER_MAP[productId] || { tier: "pro", limit: 2000 };

    log("Upgrading user", { tier: tierInfo.tier, limit: tierInfo.limit });

    // Upgrade from free or lower tier
    await supabase
      .from("api_keys")
      .update({ tier: tierInfo.tier, daily_limit: tierInfo.limit })
      .eq("user_id", userId)
      .eq("is_active", true)
      .in("tier", ["free", "lite"]);

    // Also upgrade lite→pro if applicable
    if (tierInfo.tier === "pro") {
      await supabase
        .from("api_keys")
        .update({ tier: "pro", daily_limit: 2000 })
        .eq("user_id", userId)
        .eq("is_active", true)
        .eq("tier", "lite");
    }
  } else {
    // No active subscription - check legacy one-time payments before downgrading
    const sessions = await stripe.checkout.sessions.list({
      customer: customerId,
      limit: 50,
    });
    const proSessions = sessions.data.filter(
      (s) => s.payment_status === "paid" && s.status === "complete" && s.mode === "payment" &&
        (!s.metadata?.type || s.metadata?.type === "pro")
    );

    let hasLegacyPro = false;
    for (const session of proSessions) {
      if (session.payment_intent) {
        try {
          const refunds = await stripe.refunds.list({
            payment_intent: session.payment_intent as string,
            limit: 1,
          });
          if (refunds.data.length === 0 || refunds.data[0].status !== "succeeded") {
            hasLegacyPro = true;
            break;
          }
        } catch {
          hasLegacyPro = true;
          break;
        }
      }
    }

    // Check lifetime pro
    const { data: lifetimeKeys } = await supabase
      .from("api_keys")
      .select("id")
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("tier", "pro_lifetime")
      .limit(1);

    if (!hasLegacyPro && (!lifetimeKeys || lifetimeKeys.length === 0)) {
      log("Downgrading user to free", { userId });
      await supabase
        .from("api_keys")
        .update({ tier: "free", daily_limit: 30 })
        .eq("user_id", userId)
        .eq("is_active", true)
        .in("tier", ["pro", "lite"]);
    } else {
      log("User has legacy/lifetime pro, skipping downgrade", { userId });
    }
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string;
  if (!customerId) return;

  const customer = await stripe.customers.retrieve(customerId);
  if ((customer as any).deleted || !(customer as Stripe.Customer).email) return;
  const email = (customer as Stripe.Customer).email!;
  const userId = await getUserIdByEmail(email);
  if (!userId) {
    log("No user found for checkout", { email });
    return;
  }

  // Handle credit pack purchases
  const type = session.metadata?.type;
  if (type === "credits" || type === "credits_free") {
    const sessionId = session.id;
    const { data: existingClaim } = await supabase
      .from("credit_pack_claims")
      .select("id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (!existingClaim) {
      const { data: activeKeys } = await supabase
        .from("api_keys")
        .select("id, bonus_credits")
        .eq("user_id", userId)
        .eq("is_active", true);

      if (activeKeys && activeKeys.length > 0) {
        const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString();
        await supabase
          .from("api_keys")
          .update({
            bonus_credits: (activeKeys[0].bonus_credits || 0) + 500,
            bonus_expires_at: expiresAt,
          })
          .eq("id", activeKeys[0].id);
        log("Added 500 bonus credits", { sessionId, expiresAt });
      }

      await supabase.from("credit_pack_claims").insert({
        user_id: userId,
        stripe_session_id: sessionId,
        credits_added: 500,
      });
    }
    return;
  }

  // For subscription checkouts, sync the tier
  if (session.mode === "subscription") {
    await syncSubscriptionTier(customerId);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    log("Missing stripe-signature header");
    return new Response(JSON.stringify({ error: "Missing signature" }), { status: 400 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    log("STRIPE_WEBHOOK_SECRET not configured");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), { status: 500 });
  }

  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    log("Webhook signature verification failed", { error: (err as Error).message });
    return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
  }

  log("Event received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutCompleted(session);
        break;
      }
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        await syncSubscriptionTier(customerId);
        break;
      }
      default:
        log("Unhandled event type", { type: event.type });
    }
  } catch (err) {
    log("Error processing event", { error: (err as Error).message, type: event.type });
    return new Response(JSON.stringify({ error: "Processing failed" }), { status: 500 });
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
});
