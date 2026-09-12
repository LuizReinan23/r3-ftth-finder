import { createServerFn } from "@tanstack/react-start";

type IxcRegistro = Record<string, unknown>;

const IXC_URL = "https://central.r3internet.com.br/webservice/v1/rad_caixa_ftth";
const RP = 1000;

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s === "" ? null : s;
}

function numero(valor: unknown): number | null {
  const s = texto(valor);
  if (s === null) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export const syncIxcCaixas = createServerFn({ method: "POST" }).handler(async () => {
  const username = process.env["IXC_USERNAME"];
  const password = process.env["IXC_PASSWORD"];

  if (!username || !password) {
    throw new Error(
      "Credenciais da IXC não configuradas. Cadastre IXC_USERNAME e IXC_PASSWORD nos Secrets do projeto.",
    );
  }

  const auth = btoa(`${username}:${password}`);
  const registros: IxcRegistro[] = [];
  let page = 1;

  while (page <= 500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);

    let resposta: Response;
    try {
      resposta = await fetch(IXC_URL, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          ixcsoft: "listar",
        },
        body: JSON.stringify({
          qtype: "rad_caixa_ftth.id",
          query: "1",
          oper: ">=",
          page: String(page),
          rp: String(RP),
          sortname: "rad_caixa_ftth.id",
          sortorder: "desc",
        }),
        signal: controller.signal,
      });
    } catch (erro) {
      clearTimeout(timer);
      if (erro instanceof Error && erro.name === "AbortError") {
        throw new Error("Tempo esgotado ao consultar as caixas na IXC. Tente novamente em instantes.");
      }
      throw new Error("Não foi possível conectar ao servidor da IXC.");
    }
    clearTimeout(timer);

    if (resposta.status === 401 || resposta.status === 403) {
      throw new Error("Acesso negado pela IXC. Verifique o usuário e a senha cadastrados.");
    }
    if (!resposta.ok) {
      throw new Error(`A IXC respondeu com erro (código ${resposta.status}).`);
    }

    const json = (await resposta.json()) as { registros?: IxcRegistro[] };
    const lote = Array.isArray(json.registros) ? json.registros : [];
    registros.push(...lote);

    if (lote.length < RP) break;
    page += 1;
  }

  const agora = new Date().toISOString();
  const linhas = registros
    .map((r) => ({
      id: texto(r["id"]),
      descricao: texto(r["descricao"]),
      capacidade: numero(r["capacidade"]),
      status: texto(r["status"]),
      endereco: texto(r["endereco"]),
      latitude: texto(r["latitude"]),
      longitude: texto(r["longitude"]),
      id_transmissor: texto(r["id_transmissor"]),
      id_interface: texto(r["id_interface"]),
      id_projeto: texto(r["id_projeto"]),
      tipo: texto(r["tipo"]),
      atualizado_em: agora,
    }))
    .filter((r): r is { id: string } & typeof r => Boolean(r.id));

  const unicas = Array.from(new Map(linhas.map((l) => [l.id, l])).values());

  if (unicas.length > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < unicas.length; i += 500) {
      const { error } = await supabaseAdmin
        .from("caixas_ftth")
        .upsert(unicas.slice(i, i + 500), { onConflict: "id" });
      if (error) throw new Error(`Falha ao gravar as caixas: ${error.message}`);
    }
  }

  return { sincronizadas: unicas.length, atualizadoEm: agora };
});
