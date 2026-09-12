import { createServerFn } from "@tanstack/react-start";

type IxcRegistro = Record<string, unknown>;

const RP = 1000;

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const s = String(valor).trim();
  return s === "" ? null : s;
}

async function buscarIxc(url: string, qtype: string, sortname: string) {
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
      resposta = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/json",
          ixcsoft: "listar",
        },
        body: JSON.stringify({
          qtype,
          query: "1",
          oper: ">=",
          page: String(page),
          rp: String(RP),
          sortname,
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

  return registros;
}

function nomeDoRegistro(r: IxcRegistro): string | null {
  const campos = ["descricao", "nome", "titulo", "razao", "descricao_projeto"];
  for (const campo of campos) {
    const v = texto(r[campo]);
    if (v) return v;
  }
  return null;
}

async function gravar(tabela: "transmissores" | "projetos", linhas: { id: string; descricao: string | null; atualizado_em: string }[]) {
  if (linhas.length === 0) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  for (let i = 0; i < linhas.length; i += 500) {
    const { error } = await supabaseAdmin
      .from(tabela)
      .upsert(linhas.slice(i, i + 500), { onConflict: "id" });
    if (error) throw new Error(`Falha ao gravar os dados: ${error.message}`);
  }
}

export const syncIxcTransmissores = createServerFn({ method: "POST" }).handler(async () => {
  const registros = await buscarIxc(
    "https://central.r3internet.com.br/webservice/v1/radpop_radio",
    "radpop_radio.id",
    "radpop_radio.id",
  );

  const agora = new Date().toISOString();
  const linhas = registros
    .map((r) => ({ id: texto(r["id"]), descricao: nomeDoRegistro(r), atualizado_em: agora }))
    .filter((r): r is { id: string; descricao: string | null; atualizado_em: string } => Boolean(r.id));

  const unicas = Array.from(new Map(linhas.map((l) => [l.id, l])).values());
  await gravar("transmissores", unicas);

  return { sincronizados: unicas.length, atualizadoEm: agora };
});

export const syncIxcProjetos = createServerFn({ method: "POST" }).handler(async () => {
  const registros = await buscarIxc(
    "https://central.r3internet.com.br/webservice/v1/df_projeto",
    "df_projeto.id",
    "df_projeto.id",
  );

  const agora = new Date().toISOString();
  const linhas = registros
    .map((r) => ({ id: texto(r["id"]), descricao: nomeDoRegistro(r), atualizado_em: agora }))
    .filter((r): r is { id: string; descricao: string | null; atualizado_em: string } => Boolean(r.id));

  const unicas = Array.from(new Map(linhas.map((l) => [l.id, l])).values());
  await gravar("projetos", unicas);

  return { sincronizados: unicas.length, atualizadoEm: agora };
});
