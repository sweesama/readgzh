
-- Restrict comments SELECT to admins and own rows only; public reads go through list_public_comments RPC
DROP POLICY IF EXISTS "Authenticated can read comments" ON public.comments;
CREATE POLICY "Users can read own comments"
ON public.comments FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.is_admin());

-- Restrict comment_votes SELECT to only the caller's own votes; aggregate counts live on comments table
DROP POLICY IF EXISTS "Authenticated can read votes" ON public.comment_votes;
CREATE POLICY "Users can read own votes"
ON public.comment_votes FOR SELECT
TO authenticated, anon
USING (voter_id = (auth.uid())::text);
