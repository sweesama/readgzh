
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_name text;
  v_supabase_url text;
  v_service_key text;
BEGIN
  -- Only notify on top-level comments (not replies), skip admin's own comments
  IF NEW.parent_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Get the commenter's display name
  SELECT COALESCE(NULLIF(BTRIM(p.display_name), ''), '匿名用户')
  INTO v_user_name
  FROM public.profiles p
  WHERE p.id = NEW.user_id;

  IF v_user_name IS NULL THEN
    v_user_name := '匿名用户';
  END IF;

  -- Get Supabase URL and service role key from environment
  SELECT decrypted_secret INTO v_supabase_url
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;

  SELECT decrypted_secret INTO v_service_key
  FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  IF v_supabase_url IS NULL OR v_service_key IS NULL THEN
    RAISE WARNING 'Missing vault secrets for comment notification';
    RETURN NEW;
  END IF;

  -- Call send-transactional-email edge function via pg_net
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

CREATE TRIGGER on_new_comment_notify
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_comment();
