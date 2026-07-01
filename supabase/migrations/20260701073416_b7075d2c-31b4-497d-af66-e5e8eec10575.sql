
CREATE OR REPLACE FUNCTION public.enforce_comment_vote_voter_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to vote';
  END IF;
  NEW.voter_id := auth.uid()::text;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_voter_id_trigger ON public.comment_votes;
CREATE TRIGGER enforce_voter_id_trigger
BEFORE INSERT OR UPDATE ON public.comment_votes
FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_vote_voter_id();
