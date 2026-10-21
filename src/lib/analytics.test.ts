import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  consumeAuthEvent,
  extractStripeSessionId,
  markAuthAttempt,
  rememberCheckout,
  resetAnalyticsStateForTests,
  trackConvertArticle,
  trackGaEvent,
  trackReturnedPurchase,
} from "@/lib/analytics";

type GtagCall = unknown[];

function installGtag(): GtagCall[] {
  const calls: GtagCall[] = [];
  window.gtag = (...args: unknown[]) => {
    calls.push(args);
  };
  return calls;
}

describe("analytics", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    resetAnalyticsStateForTests();
    delete window.gtag;
  });

  afterEach(() => {
    vi.useRealTimers();
    delete window.gtag;
  });

  it("extracts a Stripe Checkout Session id and ignores other URLs", () => {
    expect(extractStripeSessionId("https://checkout.stripe.com/c/pay/cs_test_abc123#fid")).toBe("cs_test_abc123");
    expect(extractStripeSessionId("https://checkout.stripe.com/c/pay/cs_live_Z9#fid")).toBe("cs_live_Z9");
    expect(extractStripeSessionId("https://readgzh.site/payment-success?upgraded=1")).toBeNull();
  });

  it("no-ops when gtag is missing and drops values that look like emails", () => {
    expect(() => trackGaEvent("login", { method: "email" })).not.toThrow();
    const calls = installGtag();
    trackGaEvent("login", { method: "secret@example.com", currency: "CNY", value: 9 });
    expect(calls).toEqual([["event", "login", { currency: "CNY", value: 9 }]]);
  });

  it("fires begin_checkout with plan value, then purchase once for the same Stripe session", () => {
    const calls = installGtag();
    rememberCheckout({
      type: "pro",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_session1#fid",
    });
    expect(calls[0]).toEqual([
      "event",
      "begin_checkout",
      {
        currency: "CNY",
        value: 39,
        items: [{
          item_id: "pro",
          item_name: "ReadGZH Pro monthly",
          item_category: "subscription",
          quantity: 1,
          price: 39,
        }],
      },
    ]);

    expect(trackReturnedPurchase("subscription")).toBe(true);
    expect(calls[1]?.[1]).toBe("purchase");
    expect(calls[1]?.[2]).toMatchObject({
      transaction_id: "cs_test_session1",
      currency: "CNY",
      value: 39,
      checkout_type: "subscription",
    });

    // Refresh, and a second click that reuses the same Checkout Session:
    // begin_checkout may fire again, purchase must not.
    expect(trackReturnedPurchase("subscription")).toBe(false);
    rememberCheckout({
      type: "pro",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_session1#fid",
    });
    expect(trackReturnedPurchase("subscription")).toBe(false);
    expect(calls.filter((call) => call[1] === "purchase")).toHaveLength(1);
  });

  it("uses the list price times quantity for credit packs and prefers a return-url session id", () => {
    const calls = installGtag();
    rememberCheckout({
      type: "credits_free",
      quantity: 2,
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_live_pack1",
    });
    expect(calls[0]?.[2]).toMatchObject({ currency: "CNY", value: 30 });

    expect(trackReturnedPurchase("credits", "cs_live_pack1")).toBe(true);
    expect(calls[1]?.[2]).toMatchObject({
      transaction_id: "cs_live_pack1",
      currency: "CNY",
      value: 30,
      checkout_type: "credits",
    });
  });

  it("prices crypto packs in USD and does not fire purchase on the subscription return page", () => {
    const calls = installGtag();
    rememberCheckout({
      type: "credits_crypto",
      quantity: 2,
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_crypto1",
    });
    expect(calls[0]?.[2]).toMatchObject({ currency: "USD", value: 4.98 });
    expect(trackReturnedPurchase("subscription")).toBe(false);
    expect(trackReturnedPurchase("credits")).toBe(true);
    expect(calls).toHaveLength(2);
  });

  it("does not emit begin_checkout for an in-place upgrade and omits purchase value", () => {
    const calls = installGtag();
    rememberCheckout({
      type: "pro_annual",
      checkoutUrl: "https://readgzh.site/payment-success?upgraded=1",
      switched: true,
    });
    expect(calls).toHaveLength(0);
    expect(trackReturnedPurchase("upgrade")).toBe(true);
    const params = calls[0]?.[2] as Record<string, unknown>;
    expect(params.checkout_type).toBe("upgrade");
    expect(params.currency).toBeUndefined();
    expect(params.value).toBeUndefined();
    expect(params.items).toEqual([{
      item_id: "pro_annual",
      item_name: "ReadGZH Pro annual",
      item_category: "upgrade",
      quantity: 1,
    }]);
    expect(String(params.transaction_id)).toMatch(/^upgrade_pro_annual_/);
    expect(trackReturnedPurchase("upgrade")).toBe(false);
  });

  it("does not fire a stale pending purchase", () => {
    installGtag();
    const now = Date.parse("2026-10-21T00:00:00Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    rememberCheckout({
      type: "lite",
      checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_old",
    });
    expect(trackReturnedPurchase("subscription", null, now + 49 * 60 * 60 * 1000)).toBe(false);
  });

  it("fires sign_up once for a new account and login for a later attempt", () => {
    const calls = installGtag();
    const user = {
      id: "11111111-2222-3333-4444-555555555555",
      created_at: new Date().toISOString(),
      app_metadata: { provider: "google" },
      email: "secret@example.com",
    };
    expect(consumeAuthEvent(user)).toBeNull();

    markAuthAttempt("google");
    expect(consumeAuthEvent(user)).toBe("sign_up");
    expect(calls[0]).toEqual(["event", "sign_up", { method: "google" }]);
    expect(JSON.stringify(calls)).not.toContain("secret@example.com");
    expect(JSON.stringify(calls)).not.toContain(user.id);

    markAuthAttempt("google");
    expect(consumeAuthEvent(user)).toBe("login");
    expect(calls[1]).toEqual(["event", "login", { method: "google" }]);
    expect(consumeAuthEvent(user)).toBeNull();
  });

  it("records email and apple logins for older accounts", () => {
    const calls = installGtag();
    const user = {
      id: "user-old",
      created_at: "2024-01-01T00:00:00.000Z",
      app_metadata: { provider: "email" },
    };
    markAuthAttempt("email");
    expect(consumeAuthEvent(user)).toBe("login");
    expect(calls[0]?.[2]).toEqual({ method: "email" });

    markAuthAttempt("apple");
    expect(consumeAuthEvent({ ...user, app_metadata: { provider: "apple" } })).toBe("login");
    expect(calls[1]?.[2]).toEqual({ method: "apple" });
  });

  it("tracks a successful article conversion without the article URL", () => {
    const calls = installGtag();
    trackConvertArticle(true);
    expect(calls).toEqual([[
      "event",
      "convert_article",
      { content_type: "wechat_article", cached: true },
    ]]);
  });
});
