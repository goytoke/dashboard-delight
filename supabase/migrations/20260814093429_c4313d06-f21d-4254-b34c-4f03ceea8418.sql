CREATE TABLE public.trading_days (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  day_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'open',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  grand_opening numeric,
  grand_closing numeric,
  net_of_day numeric,
  snapshot jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, day_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trading_days TO authenticated;
GRANT ALL ON public.trading_days TO service_role;

ALTER TABLE public.trading_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own trading_days" ON public.trading_days FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER t_trading_days_upd BEFORE UPDATE ON public.trading_days
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();