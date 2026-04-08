
ALTER TABLE public.api_keys ALTER COLUMN daily_limit SET DEFAULT 30;

-- Update existing free-tier keys that still have daily_limit = 50
UPDATE public.api_keys SET daily_limit = 30 WHERE tier = 'free' AND daily_limit = 50;
