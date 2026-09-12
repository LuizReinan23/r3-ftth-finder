import { createServerFn } from "@tanstack/react-start";

type IxcRegistro = Record<string, unknown>;

const IXC_URL = "https://central.r3internet.com.br/webservice/v1/radusuarios";
const RP = 20;

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s === "" ? null : s;
}

export const syncIxcClientes = createServerFn({ method: "POST" }).handler(async () => {
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
          qtype: "radusuarios.ativo",
          query: "S",
          oper: "=",
          page: String(page),
          rp: String(RP),
          sortname: "radusuarios.id",
          sortorder: "desc",
        }),
        signal: controller.signal,
      });
    } catch (erro) {
      clearTimeout(timer);
      if (erro instanceof Error && erro.name === "AbortError") {
        throw new Error("Tempo esgotado ao consultar a IXC. Tente novamente em instantes.");
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
      login: texto(r["login"]),
      id_caixa_ftth: texto(r["id_caixa_ftth"]),
      ftth_porta: texto(r["ftth_porta"]),
      status_ativo: texto(r["ativo"]) ?? "N",
      interface_transmissao: texto(r["interface_transmissao"]),
      atualizado_em: agora,
    }))
    .filter((r): r is { login: string } & typeof r => Boolean(r.login));

  const unicas = Array.from(new Map(linhas.map((l) => [l.login, l])).values());

  if (unicas.length > 0) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    for (let i = 0; i < unicas.length; i += 500) {
      const { error } = await supabaseAdmin
        .from("clientes_ftth")
        .upsert(unicas.slice(i, i + 500), { onConflict: "login" });
      if (error) throw new Error(`Falha ao gravar os dados: ${error.message}`);
    }
  }

  return { sincronizados: unicas.length, atualizadoEm: agora };
});
