CREATE TABLE public.caixas_ftth (
  id text PRIMARY KEY,
  descricao text,
  capacidade integer,
  status text,
  endereco text,
  latitude text,
  longitude text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.caixas_ftth TO anon;
GRANT SELECT ON public.caixas_ftth TO authenticated;
GRANT ALL ON public.caixas_ftth TO service_role;

ALTER TABLE public.caixas_ftth ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Leitura publica de caixas ftth"
ON public.caixas_ftth
FOR SELECT
TO anon, authenticated
USING (true);