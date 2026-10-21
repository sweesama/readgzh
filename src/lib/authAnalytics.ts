import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { consumeAuthEvent } from "@/lib/analytics";

const INSTALLED_FLAG = "__readgzhAuthAnalyticsInstalled";

/**
 * Subscribe once to Supabase auth. Only SIGNED_IN is considered, and
 * consumeAuthEvent still requires a markAuthAttempt in this tab, so
 * INITIAL_SESSION / TOKEN_REFRESHED / a session restored on page load
 * do not emit login or sign_up.
 *
 * The flag lives on window so a Vite dev reload of this module does not
 * subscribe twice. Import this from the client entry (main.tsx) only.
 * The homepage prerender imports pages directly and must not start this listener.
 */
export function installAuthAnalytics(): void {
  if (typeof window === "undefined") return;
  const host = window as Window & { [INSTALLED_FLAG]?: boolean };
  if (host[INSTALLED_FLAG]) return;
  host[INSTALLED_FLAG] = true;
  try {
    supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
      if (event !== "SIGNED_IN" || !session?.user) return;
      consumeAuthEvent(session.user);
    });
  } catch {
    // A broken auth client must not blank the app.
  }
}
