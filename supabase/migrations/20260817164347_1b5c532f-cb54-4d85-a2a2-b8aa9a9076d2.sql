CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.vps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  vps_number text,
  ip text,
  username text,
  password text,
  email text,
  provider text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.payment_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  broker text NOT NULL DEFAULT 'HFM',
  account_name text NOT NULL,
  email text,
  password text,
  login text,
  login_password text,
  first_deposit numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'reserve',
  vps_id uuid REFERENCES public.vps(id) ON DELETE SET NULL,
  activated_on date,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  username text,
  magic_number integer NOT NULL,
  email text,
  password text,
  status text NOT NULL DEFAULT 'pending',
  vps_id uuid REFERENCES public.vps(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, magic_number)
);

CREATE TABLE public.daily_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT current_date,
  opening_balance numeric,
  closing_balance numeric,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, log_date)
);

CREATE TABLE public.funding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  event_date date NOT NULL DEFAULT current_date,
  kind text NOT NULL DEFAULT 'deposit',
  amount numeric NOT NULL DEFAULT 0,
  source_type text NOT NULL DEFAULT 'binance',
  from_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  payment_source_id uuid REFERENCES public.payment_sources(id) ON DELETE SET NULL,
  note text,
  balance_before numeric,
  balance_after numeric,
  fee numeric NOT NULL DEFAULT 0,
  has_fee boolean NOT NULL DEFAULT false,
  from_balance_before numeric,
  from_balance_after numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  cost_date date NOT NULL DEFAULT current_date,
  reason text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  payment_source_id uuid REFERENCES public.payment_sources(id) ON DELETE SET NULL,
  vps_id uuid REFERENCES public.vps(id) ON DELETE SET NULL,
  notes text,
  purpose text,
  is_subscription boolean NOT NULL DEFAULT false,
  starts_on date,
  duration_value integer,
  duration_unit text NOT NULL DEFAULT 'day',
  notify_before_hours integer NOT NULL DEFAULT 24,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tx_date date NOT NULL DEFAULT current_date,
  direction text NOT NULL DEFAULT 'sent',
  amount numeric NOT NULL DEFAULT 0,
  person_id uuid REFERENCES public.people(id) ON DELETE SET NULL,
  payment_source_id uuid REFERENCES public.payment_sources(id),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE TABLE public.cost_purposes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text NOT NULL,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX profiles_username_key ON public.profiles (lower(username));

ALTER TABLE public.payment_sources ADD COLUMN starting_balance numeric NOT NULL DEFAULT 0;
ALTER TABLE public.payment_sources ADD COLUMN is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.vps ADD COLUMN purchased_on date DEFAULT CURRENT_DATE;
ALTER TABLE public.vps ADD COLUMN term_days integer NOT NULL DEFAULT 3;
ALTER TABLE public.accounts ADD COLUMN cycle_days integer NOT NULL DEFAULT 7;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vps, public.payment_sources, public.people, public.accounts, public.bots, public.daily_logs, public.funding_events, public.costs, public.transactions, public.problems, public.movements, public.trading_days, public.cost_purposes, public.profiles TO authenticated;
GRANT ALL ON public.vps, public.payment_sources, public.people, public.accounts, public.bots, public.daily_logs, public.funding_events, public.costs, public.transactions, public.problems, public.movements, public.trading_days, public.cost_purposes, public.profiles TO service_role;

ALTER TABLE public.vps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trading_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_purposes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own vps" ON public.vps FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own payment_sources" ON public.payment_sources FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own people" ON public.people FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own accounts" ON public.accounts FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own bots" ON public.bots FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own daily_logs" ON public.daily_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own funding_events" ON public.funding_events FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own costs" ON public.costs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own transactions" ON public.transactions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own problems" ON public.problems FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own movements" ON public.movements FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own trading_days" ON public.trading_days FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own cost_purposes" ON public.cost_purposes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TRIGGER t_vps_upd BEFORE UPDATE ON public.vps FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_accounts_upd BEFORE UPDATE ON public.accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_bots_upd BEFORE UPDATE ON public.bots FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_daily_logs_upd BEFORE UPDATE ON public.daily_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_problems_upd BEFORE UPDATE ON public.problems FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_movements_upd BEFORE UPDATE ON public.movements FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_trading_days_upd BEFORE UPDATE ON public.trading_days FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER t_profiles_upd BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, username, phone, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'phone',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "avatars own read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'avatars' AND owner = auth.uid());
CREATE POLICY "avatars own insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'avatars' AND owner = auth.uid());
CREATE POLICY "avatars own update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'avatars' AND owner = auth.uid());
CREATE POLICY "avatars own delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'avatars' AND owner = auth.uid());