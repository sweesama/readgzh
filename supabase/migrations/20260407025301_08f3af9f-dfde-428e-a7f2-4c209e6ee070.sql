
CREATE TABLE IF NOT EXISTS public.credit_pack_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL UNIQUE,
  credits_added integer NOT NULL DEFAULT 500,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_pack_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own claims" ON public.credit_pack_claims
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_name text;
  v_service_key text;
  v_supabase_url text := 'https://jhnnmmwgdrquwjytvvwu.supabase.co';
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(BTRIM(p.display_name), ''), '匿名用户')
  INTO v_user_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF v_user_name IS NULL THEN
    v_user_name := '匿名用户';
  END IF;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'email_queue_service_role_key' LIMIT 1;

  IF v_service_key IS NULL THEN
    RAISE WARNING 'Missing vault secret email_queue_service_role_key for comment notification';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := v_supabase_url || '/functions/v1/send-transactional-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_service_key
    ),
    body := jsonb_build_object(
      'templateName', 'new-comment',
      'templateData', jsonb_build_object(
        'userName', v_user_name,
        'commentContent', LEFT(NEW.content, 500),
        'commentUrl', 'https://readgzh.site/comments'
      )
    )
  );

  RETURN NEW;
END;
$$;
