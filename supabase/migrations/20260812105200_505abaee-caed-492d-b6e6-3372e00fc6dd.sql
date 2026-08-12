CREATE POLICY "Users can view their own manual subscriptions"
ON public.manual_subscriptions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

GRANT SELECT ON public.manual_subscriptions TO authenticated;

CREATE POLICY "Public read for email-assets bucket"
ON storage.objects
FOR SELECT
USING (bucket_id = 'email-assets');