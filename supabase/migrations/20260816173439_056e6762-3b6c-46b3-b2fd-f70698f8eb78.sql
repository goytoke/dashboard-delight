ALTER TABLE public.costs
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS is_subscription boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS duration_value integer,
  ADD COLUMN IF NOT EXISTS duration_unit text NOT NULL DEFAULT 'day',
  ADD COLUMN IF NOT EXISTS notify_before_hours integer NOT NULL DEFAULT 24;

CREATE TABLE IF NOT EXISTS public.cost_purposes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cost_purposes TO authenticated;
GRANT ALL ON public.cost_purposes TO service_role;
ALTER TABLE public.cost_purposes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own cost_purposes" ON public.cost_purposes;
CREATE POLICY "own cost_purposes" ON public.cost_purposes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);