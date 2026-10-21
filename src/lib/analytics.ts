/**
 * GA4 conversion events for the gtag snippet already in index.html
 * (measurement ID G-B55BHX0460). This module never calls gtag('config')
 * and never sends page views — the snippet already does that on first load.
 *
 * Privacy: event params are allow-listed scalars plus an items array.
 * Strings containing "@" are dropped so an email cannot be forwarded to GA.
 * User ids are used only as localStorage keys for sign_up dedupe; they are
 * never placed on an event.
 *
 * Purchase dedupe: before opening Stripe (or the in-place upgrade return
 * URL) we write one pending purchase to localStorage. The return page
 * claims that transaction id in localStorage before calling gtag, so a
 * refresh of /payment-success or /dashboard?credits_purchased= does not
 * emit a second purchase. GA also dedupes purchase on transaction_id.
 *
 * Prices below are the list prices shown in the UI and commented on
 * create-payment. They are NOT read from Stripe. Upgrade purchases omit
 * value/price because the server charges a prorated invoice and does not
 * return that amount to the client.
 */

export type GaItem = {
  item_id: string;
  item_name: string;
  item_category?: string;
  price?: number;
  quantity?: number;
};

type GaParams = Record<string, string | number | boolean | GaItem[] | undefined>;

export type CheckoutKind = "subscription" | "credits" | "upgrade";

export type AuthMethod = "google" | "apple" | "email";

export type AuthUserLike = {
  id: string;
  created_at?: string | null;
  app_metadata?: { provider?: string | null } | null;
  identities?: Array<{ provider?: string | null }> | null;
};

type Offer = {
  itemId: string;
  itemName: string;
  unitPrice: number;
  currency: "CNY" | "USD";
  kind: "subscription" | "credits";
};

type PendingPurchase = {
  transactionId: string;
  currency: "CNY" | "USD";
  value: number;
  unitPrice: number;
  itemId: string;
  itemName: string;
  quantity: number;
  kind: CheckoutKind;
  createdAt: number;
};

type AuthAttempt = {
  method: string;
  at: number;
};

const PENDING_PURCHASE_KEY = "readgzh_ga_pending_purchase_v1";
const PURCHASE_SENT_PREFIX = "readgzh_ga_purchase_sent_v1:";
const AUTH_ATTEMPT_KEY = "readgzh_ga_auth_attempt_v1";
const SIGNUP_SENT_PREFIX = "readgzh_ga_signup_v1:";

/** Account created within this window is treated as sign_up once. Covers Supabase email OTP, which creates the user when the code is sent. */
const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
/** Ignore a login click that never produced SIGNED_IN. */
const AUTH_ATTEMPT_TTL_MS = 30 * 60 * 1000;
/** Abandoned Checkout Sessions expire at 24h; keep a little slack. */
const PENDING_PURCHASE_TTL_MS = 48 * 60 * 60 * 1000;

const STRIPE_SESSION_RE = /cs_(?:live|test)_[A-Za-z0-9]+/;

/**
 * List prices mirrored from the pricing page, the dashboard credit dialog,
 * and supabase/functions/create-payment/index.ts. Update all of those
 * together if a price changes. Do not put Stripe price ids here — this
 * file must not participate in charging.
 */
const OFFERS: Record<string, Offer> = {
  lite: {
    itemId: "lite",
    itemName: "ReadGZH Lite monthly",
    unitPrice: 9,
    currency: "CNY",
    kind: "subscription",
  },
  pro: {
    itemId: "pro",
    itemName: "ReadGZH Pro monthly",
    unitPrice: 39,
    currency: "CNY",
    kind: "subscription",
  },
  pro_annual: {
    itemId: "pro_annual",
    itemName: "ReadGZH Pro annual",
    unitPrice: 299,
    currency: "CNY",
    kind: "subscription",
  },
  credits: {
    itemId: "credits",
    itemName: "ReadGZH credit pack 500",
    unitPrice: 9,
    currency: "CNY",
    kind: "credits",
  },
  credits_free: {
    itemId: "credits_free",
    itemName: "ReadGZH credit pack 500",
    unitPrice: 15,
    currency: "CNY",
    kind: "credits",
  },
  credits_crypto: {
    itemId: "credits_crypto",
    itemName: "ReadGZH credit pack 500",
    unitPrice: 2.49,
    currency: "USD",
    kind: "credits",
  },
};

const signupMemory = new Set<string>();
const purchaseMemory = new Set<string>();

declare global {
  interface Window {
    /** Defined by the inline gtag snippet in index.html. Absent when that snippet is blocked. */
    gtag?: (...args: unknown[]) => void;
  }
}

function hasGtag(): boolean {
  return typeof window !== "undefined" && typeof window.gtag === "function";
}

function clip(key: string, value: string): string | undefined {
  if (!value || value.includes("@")) return undefined;
  const max = key === "transaction_id" ? 200 : 80;
  return value.slice(0, max);
}

function sanitizeItem(item: GaItem): GaItem | undefined {
  const itemId = clip("item_id", item.item_id);
  const itemName = clip("item_name", item.item_name);
  if (!itemId || !itemName) return undefined;
  const sanitized: GaItem = { item_id: itemId, item_name: itemName };
  if (item.item_category) {
    const category = clip("item_category", item.item_category);
    if (category) sanitized.item_category = category;
  }
  if (typeof item.price === "number" && Number.isFinite(item.price)) sanitized.price = item.price;
  if (typeof item.quantity === "number" && Number.isFinite(item.quantity)) sanitized.quantity = item.quantity;
  return sanitized;
}

/** Push one GA4 event. No-ops when gtag is missing or blocked. Never throws. */
export function trackGaEvent(name: string, params?: GaParams): void {
  try {
    if (!hasGtag() || !name) return;
    const payload: Record<string, unknown> = {};
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined || value === null || value === "") continue;
        if (typeof value === "string") {
          const safe = clip(key, value);
          if (safe) payload[key] = safe;
          continue;
        }
        if (typeof value === "number" && Number.isFinite(value)) {
          payload[key] = value;
          continue;
        }
        if (typeof value === "boolean") {
          payload[key] = value;
          continue;
        }
        if (key === "items" && Array.isArray(value)) {
          const items = value.map((item) => sanitizeItem(item)).filter((item): item is GaItem => Boolean(item));
          if (items.length) payload.items = items;
        }
      }
    }
    window.gtag!("event", name, payload);
  } catch {
    // Analytics must never break signup, checkout, or article conversion.
  }
}

export function extractStripeSessionId(checkoutUrl: string): string | null {
  if (!checkoutUrl) return null;
  const match = checkoutUrl.match(STRIPE_SESSION_RE);
  return match ? match[0] : null;
}

function isStripeCheckoutUrl(checkoutUrl: string): boolean {
  try {
    return new URL(checkoutUrl).hostname === "checkout.stripe.com";
  } catch {
    return checkoutUrl.includes("checkout.stripe.com");
  }
}

function money(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function clampQuantity(type: string, quantity: number | undefined): number {
  if (type === "lite" || type === "pro" || type === "pro_annual") return 1;
  const raw = Number(quantity);
  if (!Number.isFinite(raw)) return 1;
  return Math.min(20, Math.max(1, Math.floor(raw)));
}

export function resolveOffer(type: string, quantity: number | undefined): (Offer & { quantity: number; value: number }) | null {
  const offer = OFFERS[type];
  if (!offer) return null;
  const qty = clampQuantity(type, quantity);
  return { ...offer, quantity: qty, value: money(offer.unitPrice * qty) };
}

function readStorage(store: Storage, key: string): string | null {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(store: Storage, key: string, value: string): void {
  try {
    store.setItem(key, value);
  } catch {
    // Private mode or a full quota: skip persistence, still try to send once.
  }
}

function removeStorage(store: Storage, key: string): void {
  try {
    store.removeItem(key);
  } catch {
    // ignore
  }
}

function savePending(pending: PendingPurchase): void {
  if (typeof localStorage === "undefined") return;
  writeStorage(localStorage, PENDING_PURCHASE_KEY, JSON.stringify(pending));
}

function readPending(now: number): PendingPurchase | null {
  if (typeof localStorage === "undefined") return null;
  const raw = readStorage(localStorage, PENDING_PURCHASE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingPurchase;
    if (!parsed || typeof parsed.transactionId !== "string" || typeof parsed.createdAt !== "number") {
      removeStorage(localStorage, PENDING_PURCHASE_KEY);
      return null;
    }
    if (now - parsed.createdAt > PENDING_PURCHASE_TTL_MS) {
      removeStorage(localStorage, PENDING_PURCHASE_KEY);
      return null;
    }
    return parsed;
  } catch {
    removeStorage(localStorage, PENDING_PURCHASE_KEY);
    return null;
  }
}

function clearPending(): void {
  if (typeof localStorage === "undefined") return;
  removeStorage(localStorage, PENDING_PURCHASE_KEY);
}

function claimTransaction(transactionId: string): boolean {
  if (purchaseMemory.has(transactionId)) return false;
  if (typeof localStorage !== "undefined") {
    const key = PURCHASE_SENT_PREFIX + transactionId;
    if (readStorage(localStorage, key) === "1") {
      purchaseMemory.add(transactionId);
      return false;
    }
    writeStorage(localStorage, key, "1");
    if (readStorage(localStorage, key) !== "1" && typeof sessionStorage !== "undefined") {
      if (readStorage(sessionStorage, key) === "1") {
        purchaseMemory.add(transactionId);
        return false;
      }
      writeStorage(sessionStorage, key, "1");
    }
  }
  purchaseMemory.add(transactionId);
  return true;
}

function toItem(pending: PendingPurchase, includePrice: boolean): GaItem {
  return {
    item_id: pending.itemId,
    item_name: pending.itemName,
    item_category: pending.kind,
    quantity: pending.quantity,
    ...(includePrice ? { price: pending.unitPrice } : {}),
  };
}

/**
 * Call after create-payment returns a URL, before window.open.
 * Stripe Checkout URLs emit begin_checkout. In-place subscription switches
 * (data.switched / ?upgraded=1) skip begin_checkout because Stripe Checkout
 * never opens; the success page emits purchase instead.
 */
export function rememberCheckout(input: {
  type: string;
  quantity?: number;
  checkoutUrl: string;
  switched?: boolean;
}): void {
  try {
    const offer = resolveOffer(input.type, input.quantity);
    if (!offer || !input.checkoutUrl) return;
    const switched = Boolean(input.switched);
    const sessionId = extractStripeSessionId(input.checkoutUrl);
    const kind: CheckoutKind = switched ? "upgrade" : offer.kind;
    const transactionId = sessionId
      ?? `${kind}_${offer.itemId}_${Date.now()}`;
    savePending({
      transactionId,
      currency: offer.currency,
      value: offer.value,
      unitPrice: offer.unitPrice,
      itemId: offer.itemId,
      itemName: offer.itemName,
      quantity: offer.quantity,
      kind,
      createdAt: Date.now(),
    });
    if (!switched && isStripeCheckoutUrl(input.checkoutUrl)) {
      trackGaEvent("begin_checkout", {
        currency: offer.currency,
        value: offer.value,
        items: [toItem({
          transactionId,
          currency: offer.currency,
          value: offer.value,
          unitPrice: offer.unitPrice,
          itemId: offer.itemId,
          itemName: offer.itemName,
          quantity: offer.quantity,
          kind,
          createdAt: Date.now(),
        }, true)],
      });
    }
  } catch {
    // never block the checkout window
  }
}

export function trackCheckoutHandoff(input: {
  type: string;
  quantity?: number;
  data: { url?: unknown; switched?: unknown } | null | undefined;
}): void {
  const url = typeof input.data?.url === "string" ? input.data.url : "";
  if (!url) return;
  const switched = Boolean(input.data?.switched) || /[?&]upgraded=1(?:&|$)/.test(url);
  rememberCheckout({
    type: input.type,
    quantity: input.quantity,
    checkoutUrl: url,
    switched,
  });
}

/**
 * Fire purchase once for the pending checkout that matches the page the
 * shopper actually returned to. Returns false when there is nothing to send
 * (no pending record, wrong return page, expired, already sent, or no gtag).
 */
export function trackReturnedPurchase(
  expected: CheckoutKind,
  sessionIdFromUrl?: string | null,
  now = Date.now(),
): boolean {
  try {
    const pending = readPending(now);
    if (!pending || pending.kind !== expected) return false;
    if (!hasGtag()) return false;

    const fromUrl = sessionIdFromUrl ? extractStripeSessionId(sessionIdFromUrl) : null;
    const transactionId = fromUrl || pending.transactionId;
    if (!claimTransaction(transactionId)) {
      clearPending();
      return false;
    }
    clearPending();

    const includePrice = pending.kind !== "upgrade";
    trackGaEvent("purchase", {
      transaction_id: transactionId,
      checkout_type: pending.kind,
      ...(includePrice ? { currency: pending.currency, value: pending.value } : {}),
      items: [toItem({ ...pending, transactionId, kind: pending.kind }, includePrice)],
    });
    return true;
  } catch {
    return false;
  }
}

/** Successful homepage conversion. Does not send the WeChat URL or article text. */
export function trackConvertArticle(cached: boolean): void {
  trackGaEvent("convert_article", {
    content_type: "wechat_article",
    cached,
  });
}

/** Call immediately before starting Google, Apple, or email OTP verification. */
export function markAuthAttempt(method: AuthMethod): void {
  if (typeof sessionStorage === "undefined") return;
  const attempt: AuthAttempt = { method, at: Date.now() };
  writeStorage(sessionStorage, AUTH_ATTEMPT_KEY, JSON.stringify(attempt));
}

export function clearAuthAttempt(): void {
  if (typeof sessionStorage === "undefined") return;
  removeStorage(sessionStorage, AUTH_ATTEMPT_KEY);
}

function readAuthAttempt(now: number): AuthAttempt | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = readStorage(sessionStorage, AUTH_ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AuthAttempt;
    if (!parsed || typeof parsed.method !== "string" || typeof parsed.at !== "number") {
      clearAuthAttempt();
      return null;
    }
    if (now - parsed.at > AUTH_ATTEMPT_TTL_MS || now < parsed.at) {
      clearAuthAttempt();
      return null;
    }
    return parsed;
  } catch {
    clearAuthAttempt();
    return null;
  }
}

function hasSignupBeenTracked(userId: string): boolean {
  if (signupMemory.has(userId)) return true;
  if (typeof localStorage === "undefined") return false;
  return readStorage(localStorage, SIGNUP_SENT_PREFIX + userId) === "1";
}

function markSignupTracked(userId: string): void {
  signupMemory.add(userId);
  if (typeof localStorage === "undefined") return;
  writeStorage(localStorage, SIGNUP_SENT_PREFIX + userId, "1");
}

export function resolveAuthMethod(user: AuthUserLike, attempted: string | undefined): string {
  const provider = user.app_metadata?.provider
    || user.identities?.find((identity) => identity.provider && identity.provider !== "email")?.provider
    || user.identities?.[0]?.provider
    || attempted
    || "email";
  if (provider === "google" || provider === "apple" || provider === "email") return provider;
  if (provider.includes("@")) return attempted && !attempted.includes("@") ? attempted : "email";
  return provider;
}

/**
 * SIGNED_IN is ignored unless this tab recently called markAuthAttempt.
 * That keeps session restore and other tabs from counting as login.
 * A first sign-in for an account created in the last hour is sign_up;
 * later sign-ins in that hour are login (the sign_up flag is already set).
 */
export function consumeAuthEvent(user: AuthUserLike, now = Date.now()): "sign_up" | "login" | null {
  try {
    const pending = readAuthAttempt(now);
    if (!pending) return null;
    clearAuthAttempt();
    if (!user?.id || user.id.includes("@")) return null;
    if (!hasGtag()) return null;

    const method = resolveAuthMethod(user, pending.method);
    const created = user.created_at ? Date.parse(user.created_at) : NaN;
    const recentAccount = Number.isFinite(created) && now >= created && now - created < SIGNUP_WINDOW_MS;
    const eventName: "sign_up" | "login" = recentAccount && !hasSignupBeenTracked(user.id) ? "sign_up" : "login";
    if (eventName === "sign_up") markSignupTracked(user.id);
    trackGaEvent(eventName, { method });
    return eventName;
  } catch {
    return null;
  }
}

/** Test-only reset of in-memory dedupe. Does not touch the network. */
export function resetAnalyticsStateForTests(): void {
  signupMemory.clear();
  purchaseMemory.clear();
}
