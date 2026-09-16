import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/integrations/supabase/types";

function clientePublico() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
  return createClient<Database>(process.env["SUPABASE_URL"]!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

const BLOCO = 1000;

async function lerTudo<T>(
  tabela: "clientes_ftth" | "caixas_ftth" | "transmissores" | "interfaces_ftth" | "projetos",
  colunas: string,
  ordem: string,
  maximo: number,
): Promise<T[]> {
  const sb = clientePublico();
  const linhas: T[] = [];
  for (let inicio = 0; inicio < maximo; inicio += BLOCO) {
    const { data, error } = await sb
      .from(tabela)
      .select(colunas)
      .order(ordem, { ascending: true })
      .range(inicio, inicio + BLOCO - 1);
    if (error) throw new Error(error.message);
    const lote = (data ?? []) as unknown as T[];
    linhas.push(...lote);
    if (lote.length < BLOCO) break;
  }
  return linhas;
}

export const listClientesFtth = createServerFn({ method: "GET" }).handler(async () =>
  lerTudo<Tables<"clientes_ftth">>(
    "clientes_ftth",
    "id, login, id_caixa_ftth, ftth_porta, status_ativo, online, interface_transmissao, atualizado_em",
    "login",
    60000,
  ),
);

export const listCaixasFtth = createServerFn({ method: "GET" }).handler(async () =>
  lerTudo<Tables<"caixas_ftth">>(
    "caixas_ftth",
    "id, descricao, capacidade, status, endereco, tipo, id_transmissor, id_interface, id_projeto, atualizado_em",
    "id",
    30000,
  ),
);

export const listTransmissores = createServerFn({ method: "GET" }).handler(async () =>
  lerTudo<Tables<"transmissores">>("transmissores", "id, descricao, atualizado_em", "id", 10000),
);

export const listInterfacesFtth = createServerFn({ method: "GET" }).handler(async () =>
  lerTudo<Tables<"interfaces_ftth">>("interfaces_ftth", "id, transmissor, interface, atualizado_em", "id", 10000),
);

export const listProjetos = createServerFn({ method: "GET" }).handler(async () =>
  lerTudo<Tables<"projetos">>("projetos", "id, descricao, atualizado_em", "id", 10000),
);
