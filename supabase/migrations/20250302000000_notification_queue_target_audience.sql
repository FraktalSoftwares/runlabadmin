-- Add target_audience column to notification_queue
-- Allows distinguishing between notifications for Corredores vs Parceiros
ALTER TABLE public.notification_queue
  ADD COLUMN IF NOT EXISTS target_audience text NOT NULL DEFAULT 'Corredor';

-- Update process_notification_queue_item to route by target_audience
CREATE OR REPLACE FUNCTION public.process_notification_queue_item(queue_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, description)
  SELECT p.id, 'maintenance', nq.title, nq.description
  FROM public.notification_queue nq
  CROSS JOIN public.profiles p
  WHERE nq.id = queue_id
    AND nq.status = 'pending'
    AND (
      (nq.target_audience = 'Parceiro' AND p.tipo_user = 'Parceiro' AND p.is_partner = true)
      OR
      (nq.target_audience = 'Corredor' AND p.tipo_user = 'Corredor')
    );
  UPDATE public.notification_queue SET status = 'sent' WHERE id = queue_id;
END;
$$;
