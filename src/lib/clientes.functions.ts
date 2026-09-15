import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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

export const listClientesFtth = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await clientePublico()
    .from("clientes_ftth")
    .select(
      "id, login, id_caixa_ftth, ftth_porta, status_ativo, online, interface_transmissao, atualizado_em",
    )
    .order("atualizado_em", { ascending: false })
    .limit(50000);

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listCaixasFtth = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await clientePublico()
    .from("caixas_ftth")
    .select(
      "id, descricao, capacidade, status, endereco, tipo, id_transmissor, id_interface, id_projeto, atualizado_em",
    )
    .limit(20000);

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listTransmissores = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await clientePublico()
    .from("transmissores")
    .select("id, descricao, atualizado_em")
    .limit(5000);

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listInterfacesFtth = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await clientePublico()
    .from("interfaces_ftth")
    .select("id, transmissor, interface, atualizado_em")
    .limit(5000);

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listProjetos = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await clientePublico()
    .from("projetos")
    .select("id, descricao, atualizado_em")
    .limit(5000);

  if (error) throw new Error(error.message);
  return data ?? [];
});
