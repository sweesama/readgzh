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
  v_parent_user_id uuid;
  v_parent_user_email text;
  v_parent_content text;
BEGIN
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
    RAISE WARNING 'Missing vault secret email_queue_service_role_key';
    RETURN NEW;
  END IF;

  IF NEW.parent_id IS NULL THEN
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
  ELSE
    SELECT c.user_id, LEFT(c.content, 200)
    INTO v_parent_user_id, v_parent_content
    FROM public.comments c
    WHERE c.id = NEW.parent_id;

    IF v_parent_user_id IS NOT NULL AND v_parent_user_id != NEW.user_id THEN
      SELECT p.email
      INTO v_parent_user_email
      FROM public.profiles p
      WHERE p.id = v_parent_user_id;

      IF v_parent_user_email IS NOT NULL THEN
        PERFORM net.http_post(
          url := v_supabase_url || '/functions/v1/send-transactional-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := jsonb_build_object(
            'templateName', 'comment-reply',
            'recipientEmail', v_parent_user_email,
            'templateData', jsonb_build_object(
              'replierName', v_user_name,
              'replyContent', LEFT(NEW.content, 500),
              'originalContent', v_parent_content,
              'commentUrl', 'https://readgzh.site/comments'
            )
          )
        );
      END IF;
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_new_comment_notify ON public.comments;
CREATE TRIGGER on_new_comment_notify
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_comment();