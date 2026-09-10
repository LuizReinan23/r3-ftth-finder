CREATE TABLE public.clientes_ftth (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  login TEXT NOT NULL UNIQUE,
  id_caixa_ftth TEXT,
  ftth_porta TEXT,
  status_ativo TEXT,
  atualizado_em TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.clientes_ftth TO anon;
GRANT SELECT ON public.clientes_ftth TO authenticated;
GRANT ALL ON public.clientes_ftth TO service_role;

ALTER TABLE public.clientes_ftth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura publica de clientes ftth"
  ON public.clientes_ftth
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX idx_clientes_ftth_login ON public.clientes_ftth (login);