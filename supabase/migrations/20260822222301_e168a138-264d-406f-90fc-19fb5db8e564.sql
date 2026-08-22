CREATE TABLE public.day_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  result_date date NOT NULL DEFAULT CURRENT_DATE,
  vps_id uuid REFERENCES public.vps(id) ON DELETE SET NULL,
  register_number text,
  direction text NOT NULL DEFAULT 'profit',
  amount numeric NOT NULL DEFAULT 0,
  label text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_results TO authenticated;
GRANT ALL ON public.day_results TO service_role;
ALTER TABLE public.day_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own day_results" ON public.day_results FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER t_day_results_upd BEFORE UPDATE ON public.day_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.saved_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'daily',
  from_date date NOT NULL,
  to_date date NOT NULL,
  heading text NOT NULL,
  sheets jsonb NOT NULL DEFAULT '[]'::jsonb,
  theory jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_reports TO authenticated;
GRANT ALL ON public.saved_reports TO service_role;
ALTER TABLE public.saved_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own saved_reports" ON public.saved_reports FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER t_saved_reports_upd BEFORE UPDATE ON public.saved_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();