CREATE TABLE public.interfaces_ftth (
  id text PRIMARY KEY,
  transmissor text,
  interface text,
  atualizado_em timestamptz not null default now()
);
GRANT SELECT ON public.interfaces_ftth TO anon, authenticated;
GRANT ALL ON public.interfaces_ftth TO service_role;
ALTER TABLE public.interfaces_ftth ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura publica de interfaces_ftth" ON public.interfaces_ftth FOR SELECT TO anon, authenticated USING (true);