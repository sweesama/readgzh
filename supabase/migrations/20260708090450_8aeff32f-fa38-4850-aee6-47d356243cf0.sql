
DROP POLICY IF EXISTS "Authenticated users can insert comments" ON public.comments;

CREATE POLICY "Authenticated users can insert comments"
ON public.comments
FOR INSERT
TO authenticated
WITH CHECK (
  (is_anonymous = true  AND auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()))
  OR
  (is_anonymous = false AND auth.uid() = user_id)
);
