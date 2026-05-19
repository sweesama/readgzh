// Captures ?ref=XXX from the URL and binds the referral after sign-up/sign-in.
// Mounted once at the root level inside <BrowserRouter>.
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  captureRefFromUrl,
  getPendingRef,
  markReferralClaimed,
} from "@/lib/referral";

const ReferralCatcher = () => {
  const claimedRef = useRef(false);

  useEffect(() => {
    // 1) Capture ?ref= from current URL
    captureRefFromUrl();

    // 2) When auth state becomes SIGNED_IN, try to claim
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== "SIGNED_IN" || !session?.user) return;
      if (claimedRef.current) return;
      const code = getPendingRef();
      if (!code) return;
      claimedRef.current = true;
      try {
        const { data, error } = await supabase.functions.invoke("referral-claim", {
          body: { code },
        });
        if (!error && data?.ok) {
          markReferralClaimed();
        } else {
          // Mark claimed regardless on terminal failures to avoid retry loops
          if (data?.reason && ["invalid_code", "self_invite", "same_email", "already_invited", "account_too_old"].includes(data.reason)) {
            markReferralClaimed();
          }
        }
      } catch {
        // network glitch — leave for retry on next sign-in
        claimedRef.current = false;
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
};

export default ReferralCatcher;
