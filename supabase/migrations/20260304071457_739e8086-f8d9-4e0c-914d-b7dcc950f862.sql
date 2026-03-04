-- Profiles table for user info
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- API Keys table
CREATE TABLE public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  name text NOT NULL DEFAULT 'Default',
  tier text NOT NULL DEFAULT 'free',
  daily_limit integer NOT NULL DEFAULT 50,
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own keys"
  ON public.api_keys FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own keys"
  ON public.api_keys FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own keys"
  ON public.api_keys FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE UNIQUE INDEX idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX idx_api_keys_user_id ON public.api_keys(user_id);

-- API Usage tracking table
CREATE TABLE public.api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id uuid NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  request_count integer NOT NULL DEFAULT 0,
  cached_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(api_key_id, usage_date)
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage"
  ON public.api_usage FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.api_keys
      WHERE api_keys.id = api_usage.api_key_id
      AND api_keys.user_id = auth.uid()
    )
  );

CREATE INDEX idx_api_usage_key_date ON public.api_usage(api_key_id, usage_date);

-- Daily credits table
CREATE TABLE public.daily_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_date date NOT NULL DEFAULT CURRENT_DATE,
  credits_claimed integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, claim_date)
);

ALTER TABLE public.daily_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credits"
  ON public.daily_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credits"
  ON public.daily_credits FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Function to validate API key and check rate limit
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key RECORD;
  v_usage INTEGER;
  v_daily_limit INTEGER;
  v_result JSON;
BEGIN
  SELECT * INTO v_key FROM public.api_keys WHERE key_hash = p_key_hash AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN json_build_object('valid', false, 'error', 'Invalid API key');
  END IF;

  v_daily_limit := v_key.daily_limit;

  INSERT INTO public.api_usage (api_key_id, usage_date, request_count)
  VALUES (v_key.id, CURRENT_DATE, 1)
  ON CONFLICT (api_key_id, usage_date)
  DO UPDATE SET request_count = api_usage.request_count + 1, updated_at = now()
  RETURNING request_count INTO v_usage;

  UPDATE public.api_keys SET last_used_at = now() WHERE id = v_key.id;

  v_result := json_build_object(
    'valid', true,
    'allowed', v_usage <= v_daily_limit,
    'user_id', v_key.user_id,
    'tier', v_key.tier,
    'current', v_usage,
    'limit', v_daily_limit,
    'remaining', GREATEST(0, v_daily_limit - v_usage)
  );

  RETURN v_result;
END;
$$;

-- Function to record cache hit
CREATE OR REPLACE FUNCTION public.record_cache_hit(p_key_hash text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_id uuid;
BEGIN
  SELECT id INTO v_key_id FROM public.api_keys WHERE key_hash = p_key_hash AND is_active = true;
  IF FOUND THEN
    INSERT INTO public.api_usage (api_key_id, usage_date, cached_count)
    VALUES (v_key_id, CURRENT_DATE, 1)
    ON CONFLICT (api_key_id, usage_date)
    DO UPDATE SET cached_count = api_usage.cached_count + 1, updated_at = now();
  END IF;
END;
$$;