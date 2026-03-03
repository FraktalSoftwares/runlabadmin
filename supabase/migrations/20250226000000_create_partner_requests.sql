-- Migration: create partner_requests table and RLS for Administrador SELECT
-- Run this in Supabase SQL Editor if the table does not exist yet.

-- Table: partner_requests
CREATE TABLE IF NOT EXISTS public.partner_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  tipo_parceiro text,
  phone text,
  cpf_cnpj text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Optional: index for common filters
CREATE INDEX IF NOT EXISTS idx_partner_requests_user_id ON public.partner_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_partner_requests_status ON public.partner_requests(status);
CREATE INDEX IF NOT EXISTS idx_partner_requests_created_at ON public.partner_requests(created_at DESC);

-- Enable RLS
ALTER TABLE public.partner_requests ENABLE ROW LEVEL SECURITY;

-- Policy: only users with tipo_user = 'Administrador' in profiles can SELECT
CREATE POLICY "Administrador can SELECT partner_requests"
  ON public.partner_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tipo_user = 'Administrador'
    )
  );

-- Optional: allow authenticated users to INSERT their own row (e.g. form submission)
-- Uncomment if partners submit requests from the app:
-- CREATE POLICY "Users can INSERT own partner_requests"
--   ON public.partner_requests
--   FOR INSERT
--   TO authenticated
--   WITH CHECK (auth.uid() = user_id);

COMMENT ON TABLE public.partner_requests IS 'Solicitações de parceiros; leitura permitida apenas para Administrador (RLS).';
