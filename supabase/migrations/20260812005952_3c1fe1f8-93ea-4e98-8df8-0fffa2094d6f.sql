ALTER TABLE public.payment_sources ADD COLUMN IF NOT EXISTS starting_balance numeric NOT NULL DEFAULT 0;

ALTER TABLE public.funding_events
  ADD COLUMN IF NOT EXISTS balance_before numeric,
  ADD COLUMN IF NOT EXISTS balance_after numeric,
  ADD COLUMN IF NOT EXISTS fee numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS has_fee boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS from_balance_before numeric,
  ADD COLUMN IF NOT EXISTS from_balance_after numeric;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS payment_source_id uuid REFERENCES public.payment_sources(id);

ALTER TABLE public.bots ALTER COLUMN username DROP NOT NULL;