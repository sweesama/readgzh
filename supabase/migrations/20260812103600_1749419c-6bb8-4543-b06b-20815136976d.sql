CREATE TABLE public.enterprise_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  email text NOT NULL,
  phone text,
  plan text,
  billing_cycle text,
  invoice_type text,
  tax_id text,
  note text,
  status text NOT NULL DEFAULT 'new',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.enterprise_inquiries TO anon, authenticated;
GRANT SELECT, UPDATE ON public.enterprise_inquiries TO authenticated;
GRANT ALL ON public.enterprise_inquiries TO service_role;

ALTER TABLE public.enterprise_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit an inquiry"
ON public.enterprise_inquiries FOR INSERT TO anon, authenticated
WITH CHECK (
  length(btrim(company_name)) BETWEEN 1 AND 200
  AND length(btrim(contact_name)) BETWEEN 1 AND 100
  AND length(btrim(email)) BETWEEN 3 AND 255
  AND email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND COALESCE(length(note), 0) <= 2000
  AND COALESCE(length(phone), 0) <= 50
  AND COALESCE(length(tax_id), 0) <= 50
);

CREATE POLICY "Admins can read inquiries"
ON public.enterprise_inquiries FOR SELECT TO authenticated
USING (public.is_admin());

CREATE POLICY "Admins can update inquiries"
ON public.enterprise_inquiries FOR UPDATE TO authenticated
USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_enterprise_inquiries_updated_at
BEFORE UPDATE ON public.enterprise_inquiries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();