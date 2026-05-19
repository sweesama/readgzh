// 邀请码 URL 参数与 sessionStorage 工具
const STORAGE_KEY = "pendingReferralCode";
const CLAIMED_KEY = "referralClaimed";
const TRIGGERED_KEY = "referralTriggered";

/** 从当前 URL 读取 ?ref=XXXXXXXX 并存入 sessionStorage。如果已注册过则忽略。 */
export function captureRefFromUrl(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return null;
    const code = ref.trim().toUpperCase();
    if (!/^[A-Z2-9]{8}$/.test(code)) return null;
    // 已注册或已认领过则不覆盖
    if (sessionStorage.getItem(CLAIMED_KEY)) return null;
    sessionStorage.setItem(STORAGE_KEY, code);
    return code;
  } catch {
    return null;
  }
}

export function getPendingRef(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function markReferralClaimed() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.setItem(CLAIMED_KEY, "1");
    localStorage.setItem(CLAIMED_KEY, "1");
  } catch {}
}

export function hasReferralBeenTriggered(): boolean {
  try {
    return localStorage.getItem(TRIGGERED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markReferralTriggered() {
  try {
    localStorage.setItem(TRIGGERED_KEY, "1");
  } catch {}
}

export function buildInviteLink(code: string): string {
  return `https://readgzh.site/?ref=${code}`;
}
