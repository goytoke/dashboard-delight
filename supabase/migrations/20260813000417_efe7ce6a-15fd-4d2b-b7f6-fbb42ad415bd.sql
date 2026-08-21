CREATE TABLE public.problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  action_note text,
  solved_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.problems TO authenticated;
GRANT ALL ON public.problems TO service_role;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own problems" ON public.problems FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER t_problems_upd BEFORE UPDATE ON public.problems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  move_date date NOT NULL DEFAULT CURRENT_DATE,
  from_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  to_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  payment_source_id uuid REFERENCES public.payment_sources(id) ON DELETE SET NULL,
  withdraw_amount numeric NOT NULL DEFAULT 0,
  extra_amount numeric NOT NULL DEFAULT 0,
  extra_source_id uuid REFERENCES public.payment_sources(id) ON DELETE SET NULL,
  deposit_amount numeric NOT NULL DEFAULT 0,
  to_balance_before numeric,
  to_balance_after numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.movements TO authenticated;
GRANT ALL ON public.movements TO service_role;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own movements" ON public.movements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER t_movements_upd BEFORE UPDATE ON public.movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.vps ADD COLUMN IF NOT EXISTS purchased_on date DEFAULT CURRENT_DATE;
ALTER TABLE public.vps ADD COLUMN IF NOT EXISTS term_days integer NOT NULL DEFAULT 3;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS cycle_days integer NOT NULL DEFAULT 7;