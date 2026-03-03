-- RLS: allow Administrador to SELECT partner_withdrawal_requests and partner_commissions
-- (tables already exist; this only adds policies for the Financeiro Repasses tab)

-- partner_withdrawal_requests: admin can read all
DROP POLICY IF EXISTS "Administrador can SELECT partner_withdrawal_requests" ON public.partner_withdrawal_requests;
CREATE POLICY "Administrador can SELECT partner_withdrawal_requests"
  ON public.partner_withdrawal_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_user = 'Administrador'
    )
  );

-- partner_commissions: admin can read all (for detail dialog)
DROP POLICY IF EXISTS "Administrador can SELECT partner_commissions" ON public.partner_commissions;
CREATE POLICY "Administrador can SELECT partner_commissions"
  ON public.partner_commissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_user = 'Administrador'
    )
  );

-- partner_withdrawal_requests: admin can update (approve/reject)
DROP POLICY IF EXISTS "Administrador can UPDATE partner_withdrawal_requests" ON public.partner_withdrawal_requests;
CREATE POLICY "Administrador can UPDATE partner_withdrawal_requests"
  ON public.partner_withdrawal_requests
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_user = 'Administrador'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_user = 'Administrador'
    )
  );
