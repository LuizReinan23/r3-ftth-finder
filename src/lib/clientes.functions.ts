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
    .select("id, login, id_caixa_ftth, ftth_porta, status_ativo, atualizado_em")
    .order("atualizado_em", { ascending: false })
    .limit(5000);

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listCaixasFtth = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await clientePublico()
    .from("caixas_ftth")
    .select("id, descricao, capacidade, status, endereco, atualizado_em")
    .limit(5000);

  if (error) throw new Error(error.message);
  return data ?? [];
});
