ALTER TABLE public.caixas_ftth
  ADD COLUMN IF NOT EXISTS id_transmissor text,
  ADD COLUMN IF NOT EXISTS id_interface text,
  ADD COLUMN IF NOT EXISTS id_projeto text,
  ADD COLUMN IF NOT EXISTS tipo text;

ALTER TABLE public.clientes_ftth
  ADD COLUMN IF NOT EXISTS interface_transmissao text;

CREATE TABLE public.transmissores (
  id text PRIMARY KEY,
  descricao text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.transmissores TO anon, authenticated;
GRANT ALL ON public.transmissores TO service_role;
ALTER TABLE public.transmissores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura publica de transmissores" ON public.transmissores FOR SELECT TO anon, authenticated USING (true);

CREATE TABLE public.projetos (
  id text PRIMARY KEY,
  descricao text,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.projetos TO anon, authenticated;
GRANT ALL ON public.projetos TO service_role;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leitura publica de projetos" ON public.projetos FOR SELECT TO anon, authenticated USING (true);