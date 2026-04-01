-- Align RLS with jokers / finance_outlays / renewals (fixes “Unrestricted” in Supabase UI).
-- anon: SELECT only (TV dashboard + Realtime subscriptions).
-- authenticated: full access for admin tools.
-- service_role: bypasses RLS (GET /api/onboarding, POST /api/webhooks/zoho-leads).

ALTER TABLE public.onboarding_lead_touches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "onboarding_lead_touches_select_anon"
  ON public.onboarding_lead_touches FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "onboarding_lead_touches_all_authenticated"
  ON public.onboarding_lead_touches FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
