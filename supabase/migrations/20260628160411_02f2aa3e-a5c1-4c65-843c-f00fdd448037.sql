-- 撤销用户直接 INSERT daily_credits 的权限
-- 原因：用户可绕过 edge function 校验，自己 insert credits_claimed=999999 薅羊毛
-- edge function 使用 service_role，bypass RLS，不受影响
DROP POLICY IF EXISTS "Users can insert own credits" ON public.daily_credits;

-- 同时 revoke 表级 INSERT 权限做双重防护
REVOKE INSERT, UPDATE, DELETE ON public.daily_credits FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.daily_credits FROM anon;
-- 保留 SELECT 让用户在 dashboard 看自己今天领没领
GRANT SELECT ON public.daily_credits TO authenticated;
GRANT ALL ON public.daily_credits TO service_role;