import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CampoSelecao } from "@/components/CampoSelecao";
import {
  listCaixasFtth,
  listClientesFtth,
  listInterfacesFtth,
  listProjetos,
  listTransmissores,
} from "@/lib/clientes.functions";
import { syncIxcClientes } from "@/lib/ixc.functions";
import { syncIxcCaixas } from "@/lib/ixc-caixas.functions";
import { syncIxcProjetos, syncIxcTransmissores } from "@/lib/ixc-listas.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "R3 Internet — Painel de CTOs FTTH" },
      {
        name: "description",
        content:
          "Painel de CTOs FTTH da R3 Internet: ocupação de portas, logins offline e divergências de cadastro.",
      },
      { property: "og:title", content: "R3 Internet — Painel de CTOs FTTH" },
      {
        property: "og:description",
        content: "Ocupação de portas, logins offline e clientes com CTO divergente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

const POR_PAGINA = 10;

function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function corOcupacao(pct: number | null) {
  if (pct === null) return "bg-muted text-muted-foreground";
  if (pct >= 100) return "bg-destructive text-destructive-foreground";
  if (pct >= 70) return "bg-warning text-warning-foreground";
  return "bg-success text-success-foreground";
}

function corOffline(pct: number | null) {
  if (pct === null) return "bg-muted text-muted-foreground";
  if (pct >= 100) return "bg-destructive text-destructive-foreground";
  if (pct > 0) return "bg-warning text-warning-foreground";
  return "bg-success text-success-foreground";
}

function Badge({ classe, children }: { classe: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classe}`}
    >
      {children}
    </span>
  );
}

function Dashboard() {
  const queryClient = useQueryClient();

  const [ctoFiltro, setCtoFiltro] = useState<string | null>(null);
  const [transmissorFiltro, setTransmissorFiltro] = useState<string | null>(null);
  const [projetoFiltro, setProjetoFiltro] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState<{
    cto: string | null;
    transmissor: string | null;
    projeto: string | null;
  }>({ cto: null, transmissor: null, projeto: null });

  const [pagina, setPagina] = useState(1);
  const [ctoSelecionada, setCtoSelecionada] = useState<string | null>(null);
  const [verDivergentes, setVerDivergentes] = useState(false);
  const [buscaDivergentes, setBuscaDivergentes] = useState("");

  const listar = useServerFn(listClientesFtth);
  const listarCaixas = useServerFn(listCaixasFtth);
  const listarTransmissores = useServerFn(listTransmissores);
  const listarProjetos = useServerFn(listProjetos);
  const listarInterfaces = useServerFn(listInterfacesFtth);
  const sincronizarClientes = useServerFn(syncIxcClientes);
  const sincronizarCaixas = useServerFn(syncIxcCaixas);
  const sincronizarTransmissores = useServerFn(syncIxcTransmissores);
  const sincronizarProjetos = useServerFn(syncIxcProjetos);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes_ftth"],
    queryFn: () => listar(),
  });
  const { data: caixas = [] } = useQuery({
    queryKey: ["caixas_ftth"],
    queryFn: () => listarCaixas(),
  });
  const { data: transmissores = [] } = useQuery({
    queryKey: ["transmissores"],
    queryFn: () => listarTransmissores(),
  });
  const { data: projetos = [] } = useQuery({
    queryKey: ["projetos"],
    queryFn: () => listarProjetos(),
  });
  const { data: interfacesFtth = [] } = useQuery({
    queryKey: ["interfaces_ftth"],
    queryFn: () => listarInterfaces(),
  });

  const sync = useMutation({
    mutationFn: async () =>
      Promise.allSettled([
        sincronizarClientes(),
        sincronizarCaixas(),
        sincronizarTransmissores(),
        sincronizarProjetos(),
      ]),
    onSuccess: (resultados) => {
      const nomes = ["clientes", "caixas", "transmissores", "projetos"];
      resultados.forEach((r, i) => {
        if (r.status === "fulfilled") {
          const total =
            "sincronizados" in r.value ? r.value.sincronizados : r.value.sincronizadas;
          toast.success(`${total} ${nomes[i]} sincronizados com o IXC.`);
        } else {
          toast.error(
            r.reason instanceof Error
              ? r.reason.message
              : `Falha ao sincronizar ${nomes[i]}.`,
          );
        }
      });
      for (const chave of ["clientes_ftth", "caixas_ftth", "transmissores", "projetos"]) {
        queryClient.invalidateQueries({ queryKey: [chave] });
      }
    },
    onError: (erro: Error) => toast.error(erro.message || "Falha ao sincronizar."),
  });

  const ultimaAtualizacao = useMemo(() => {
    const datas = [
      ...clientes.map((c) => c.atualizado_em),
      ...caixas.map((c) => c.atualizado_em),
    ].filter(Boolean) as string[];
    if (datas.length === 0) return null;
    return datas.reduce((maior, d) => (d > maior ? d : maior));
  }, [clientes, caixas]);

  const mapaTransmissor = useMemo(
    () => new Map(transmissores.map((t) => [t.id, t.descricao ?? t.id])),
    [transmissores],
  );
  const mapaProjeto = useMemo(
    () => new Map(projetos.map((p) => [p.id, p.descricao ?? p.id])),
    [projetos],
  );
  const mapaCaixa = useMemo(() => new Map(caixas.map((c) => [c.id, c])), [caixas]);
  const mapaInterface = useMemo(
    () => new Map(interfacesFtth.map((i) => [i.id, i])),
    [interfacesFtth],
  );

  const traduzirInterface = (id: string | null | undefined) => {
    if (!id) return "—";
    const ref = mapaInterface.get(id);
    if (!ref) return id;
    return [ref.transmissor, ref.interface].filter(Boolean).join(" ") || id;
  };

  const clientesPorCaixa = useMemo(() => {
    const mapa = new Map<string, typeof clientes>();
    for (const c of clientes) {
      if (!c.id_caixa_ftth) continue;
      const lista = mapa.get(c.id_caixa_ftth);
      if (lista) lista.push(c);
      else mapa.set(c.id_caixa_ftth, [c]);
    }
    return mapa;
  }, [clientes]);

  const divergentes = useMemo(
    () =>
      clientes
        .map((c) => {
          const caixa = c.id_caixa_ftth ? mapaCaixa.get(c.id_caixa_ftth) : undefined;
          if (!caixa?.id_interface || !c.interface_transmissao) return null;
          if (caixa.id_interface === c.interface_transmissao) return null;
          return {
            id: c.id,
            login: c.login,
            caixa: caixa.descricao ?? caixa.id,
            esperada: caixa.id_interface,
            real: c.interface_transmissao,
          };
        })
        .filter((d): d is NonNullable<typeof d> => d !== null),
    [clientes, mapaCaixa],
  );

  const divergentesPorCaixa = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of clientes) {
      const caixa = c.id_caixa_ftth ? mapaCaixa.get(c.id_caixa_ftth) : undefined;
      if (!caixa?.id_interface || !c.interface_transmissao) continue;
      if (caixa.id_interface === c.interface_transmissao) continue;
      mapa.set(caixa.id, (mapa.get(caixa.id) ?? 0) + 1);
    }
    return mapa;
  }, [clientes, mapaCaixa]);

  const linhas = useMemo(() => {
    return caixas
      .map((caixa) => {
        const lista = clientesPorCaixa.get(caixa.id) ?? [];
        const total = lista.length;
        const offline = lista.filter((c) => c.status_ativo !== "S").length;
        const online = total - offline;
        const capacidade = caixa.capacidade ?? 0;
        return {
          ...caixa,
          capacidade,
          total,
          offline,
          online,
          pctOcupacao: capacidade > 0 ? (total / capacidade) * 100 : null,
          pctOffline: total > 0 ? (offline / total) * 100 : null,
          divergentes: divergentesPorCaixa.get(caixa.id) ?? 0,
        };
      })
      .sort((a, b) => {
        if (a.pctOcupacao === null && b.pctOcupacao === null) return b.total - a.total;
        if (a.pctOcupacao === null) return 1;
        if (b.pctOcupacao === null) return -1;
        return b.pctOcupacao - a.pctOcupacao;
      });
  }, [caixas, clientesPorCaixa, divergentesPorCaixa]);

  const filtradas = useMemo(
    () =>
      linhas.filter((l) => {
        if (aplicado.cto && l.id !== aplicado.cto) return false;
        if (aplicado.transmissor && l.id_transmissor !== aplicado.transmissor) return false;
        if (aplicado.projeto && l.id_projeto !== aplicado.projeto) return false;
        return true;
      }),
    [linhas, aplicado],
  );

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const visiveis = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA);

  const detalhe = ctoSelecionada ? linhas.find((l) => l.id === ctoSelecionada) : undefined;

  const portasDetalhe = useMemo(() => {
    if (!detalhe) return [];
    const lista = clientesPorCaixa.get(detalhe.id) ?? [];
    const porPorta = new Map<string, typeof lista>();
    for (const c of lista) {
      if (!c.ftth_porta) continue;
      const arr = porPorta.get(c.ftth_porta);
      if (arr) arr.push(c);
      else porPorta.set(c.ftth_porta, [c]);
    }
    const capacidade = detalhe.capacidade ?? 0;
    if (capacidade <= 0) {
      return Array.from(porPorta.entries())
        .sort((a, b) => Number(a[0]) - Number(b[0]))
        .map(([porta, clientes]) => ({ porta, clientes }));
    }
    return Array.from({ length: capacidade }, (_, i) => {
      const porta = String(i + 1);
      return { porta, clientes: porPorta.get(porta) ?? [] };
    });
  }, [detalhe, clientesPorCaixa]);

  const resumo = useMemo(() => {
    const todasOffline = filtradas.filter((l) => l.total > 0 && l.offline === l.total).length;
    const noLimite = filtradas.filter((l) => l.capacidade > 0 && l.total >= l.capacidade).length;
    return { todasOffline, noLimite };
  }, [filtradas]);

  const divergentesFiltrados = useMemo(() => {
    const termo = buscaDivergentes.trim().toLowerCase();
    if (!termo) return divergentes;
    return divergentes.filter(
      (d) =>
        d.login.toLowerCase().includes(termo) || d.caixa.toLowerCase().includes(termo),
    );
  }, [divergentes, buscaDivergentes]);

  const opcoesCto = useMemo(
    () => caixas.map((c) => ({ valor: c.id, rotulo: c.descricao ?? `Caixa ${c.id}` })),
    [caixas],
  );
  const opcoesTransmissor = useMemo(
    () => transmissores.map((t) => ({ valor: t.id, rotulo: t.descricao ?? t.id })),
    [transmissores],
  );
  const opcoesProjeto = useMemo(
    () => projetos.map((p) => ({ valor: p.id, rotulo: p.descricao ?? p.id })),
    [projetos],
  );

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-lg font-black tracking-tight text-primary-foreground"
            >
              R3
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                R3 Internet — Painel de CTOs FTTH
              </h1>
              <p className="text-xs text-muted-foreground">
                Última atualização: {formatarData(ultimaAtualizacao)}
              </p>
            </div>
          </div>

          <Button onClick={() => sync.mutate()} disabled={sync.isPending} className="sm:w-auto">
            {sync.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            {sync.isPending ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-6 pt-8">
        <div className="rounded-lg border border-border bg-card p-5">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-foreground">
            Filtrar informações
          </h2>
          <div className="grid gap-4 md:grid-cols-3">
            <CampoSelecao
              rotulo="CTO"
              placeholder="Selecionar CTO"
              opcoes={opcoesCto}
              valor={ctoFiltro}
              aoMudar={setCtoFiltro}
            />
            <CampoSelecao
              rotulo="Transmissor"
              placeholder="Selecionar transmissor"
              opcoes={opcoesTransmissor}
              valor={transmissorFiltro}
              aoMudar={setTransmissorFiltro}
            />
            <CampoSelecao
              rotulo="Projeto"
              placeholder="Selecionar projeto"
              opcoes={opcoesProjeto}
              valor={projetoFiltro}
              aoMudar={setProjetoFiltro}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              onClick={() => {
                setAplicado({
                  cto: ctoFiltro,
                  transmissor: transmissorFiltro,
                  projeto: projetoFiltro,
                });
                setPagina(1);
              }}
            >
              Aplicar filtros
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setCtoFiltro(null);
                setTransmissorFiltro(null);
                setProjetoFiltro(null);
                setAplicado({ cto: null, transmissor: null, projeto: null });
                setPagina(1);
              }}
            >
              Limpar
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-foreground">
            Visão geral das CTOs
          </h2>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CTO</TableHead>
                  <TableHead>Portas ocupadas</TableHead>
                  <TableHead>Qtd. de logins</TableHead>
                  <TableHead className="text-right">Logins offline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      Carregando dados...
                    </TableCell>
                  </TableRow>
                ) : visiveis.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      Nenhuma CTO encontrada. Use o botão Atualizar para sincronizar.
                    </TableCell>
                  </TableRow>
                ) : (
                  visiveis.map((l) => (
                    <TableRow
                      key={l.id}
                      onClick={() => setCtoSelecionada(l.id)}
                      className={`cursor-pointer ${l.id === ctoSelecionada ? "bg-muted" : ""}`}
                    >
                      <TableCell className="font-medium">
                        {l.descricao ?? `Caixa ${l.id}`}
                      </TableCell>
                      <TableCell>
                        <Badge classe={corOcupacao(l.pctOcupacao)}>
                          {l.pctOcupacao === null
                            ? `— (${l.total})`
                            : `${Math.round(l.pctOcupacao)}% (${l.total})`}
                        </Badge>
                      </TableCell>
                      <TableCell>{l.total}</TableCell>
                      <TableCell className="text-right">
                        <Badge classe={corOffline(l.pctOffline)}>
                          {l.pctOffline === null
                            ? "—"
                            : `${Math.round(l.pctOffline)}% (${l.offline})`}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Exibindo {visiveis.length} de {filtradas.length} registros
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                aria-label="Primeira página"
                disabled={paginaAtual === 1}
                onClick={() => setPagina(1)}
              >
                <ChevronsLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Página anterior"
                disabled={paginaAtual === 1}
                onClick={() => setPagina(paginaAtual - 1)}
              >
                <ChevronLeft />
              </Button>
              <span className="px-2 text-sm text-muted-foreground">
                {paginaAtual} / {totalPaginas}
              </span>
              <Button
                variant="outline"
                size="icon"
                aria-label="Próxima página"
                disabled={paginaAtual === totalPaginas}
                onClick={() => setPagina(paginaAtual + 1)}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="Última página"
                disabled={paginaAtual === totalPaginas}
                onClick={() => setPagina(totalPaginas)}
              >
                <ChevronsRight />
              </Button>
            </div>
          </div>
        </div>

        <aside className="flex flex-col gap-4">
          {detalhe && (
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-foreground">
                  {detalhe.descricao ?? `Caixa ${detalhe.id}`}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Fechar detalhe"
                  onClick={() => setCtoSelecionada(null)}
                >
                  <X />
                </Button>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Capacidade</dt>
                  <dd className="font-medium text-foreground">{detalhe.capacidade || "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Tipo</dt>
                  <dd className="font-medium text-foreground">{detalhe.tipo ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">OLT vinculada</dt>
                  <dd className="font-medium text-foreground">
                    {detalhe.id_transmissor
                      ? (mapaTransmissor.get(detalhe.id_transmissor) ?? detalhe.id_transmissor)
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Interface</dt>
                  <dd className="font-medium text-foreground">
                    {traduzirInterface(detalhe.id_interface)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Portas ocupadas</dt>
                  <dd className="font-medium text-foreground">{detalhe.total}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Portas disponíveis</dt>
                  <dd className="font-medium text-foreground">
                    {detalhe.capacidade > 0 ? Math.max(0, detalhe.capacidade - detalhe.total) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Logins online</dt>
                  <dd className="font-medium text-foreground">{detalhe.online}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Logins offline</dt>
                  <dd className="flex items-center gap-1 font-medium text-foreground">
                    {detalhe.offline > 0 && (
                      <AlertTriangle className="size-4 text-warning" aria-hidden />
                    )}
                    {detalhe.offline}
                  </dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-muted-foreground">Projeto</dt>
                  <dd className="font-medium text-foreground">
                    {detalhe.id_projeto
                      ? (mapaProjeto.get(detalhe.id_projeto) ?? detalhe.id_projeto)
                      : "—"}
                  </dd>
                </div>
              </dl>
              {detalhe.divergentes > 0 && (
                <p className="mt-4 rounded-md bg-muted px-3 py-2 text-xs font-medium text-foreground">
                  {detalhe.divergentes} cliente(s) com interface divergente nesta caixa
                </p>
              )}

              <div className="mt-5">
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Portas
                </h4>
                <div className="max-h-72 overflow-y-auto rounded-md border border-border">
                  <ul className="divide-y divide-border">
                    {portasDetalhe.length === 0 ? (
                      <li className="px-3 py-3 text-sm text-muted-foreground">
                        Sem portas cadastradas para esta CTO.
                      </li>
                    ) : (
                      portasDetalhe.map((p) => {
                        const conflito = p.clientes.length > 1;
                        return (
                          <li
                            key={p.porta}
                            className="flex items-start gap-3 px-3 py-2 text-sm"
                          >
                            <span className="w-10 shrink-0 font-mono font-semibold text-foreground">
                              {p.porta}
                            </span>
                            <span className="min-w-0 flex-1">
                              {p.clientes.length === 0 ? (
                                <span className="text-muted-foreground/70">Livre</span>
                              ) : conflito ? (
                                <span className="flex flex-col gap-0.5">
                                  {p.clientes.map((c) => (
                                    <span
                                      key={c.id}
                                      className={`flex items-center gap-1 ${
                                        c.status_ativo !== "S"
                                          ? "text-destructive"
                                          : "text-foreground"
                                      }`}
                                    >
                                      {c.login}
                                      {c.status_ativo !== "S" && (
                                        <span className="text-[10px] uppercase text-muted-foreground">
                                          offline
                                        </span>
                                      )}
                                    </span>
                                  ))}
                                </span>
                              ) : (() => {
                                  const cli = p.clientes[0]!;
                                  const offline = cli.status_ativo !== "S";
                                  return (
                                    <span
                                      className={`flex items-center gap-1 ${
                                        offline ? "text-destructive" : "text-foreground"
                                      }`}
                                    >
                                      {cli.login}
                                      {offline && (
                                        <span className="text-[10px] uppercase text-muted-foreground">
                                          offline
                                        </span>
                                      )}
                                    </span>
                                  );
                                })()
                              )}
                            </span>
                            {conflito && (
                              <Badge classe="bg-destructive text-destructive-foreground">
                                conflito
                              </Badge>
                            )}
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                100% dos logins offline
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{resumo.todasOffline}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                No limite de portas
              </p>
              <p className="mt-1 text-2xl font-bold text-foreground">{resumo.noLimite}</p>
            </div>
            <button
              type="button"
              onClick={() => setVerDivergentes((v) => !v)}
              aria-expanded={verDivergentes}
              className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-muted"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Clientes com CTO divergente
              </p>
              <p className="mt-1 text-2xl font-bold text-primary">{divergentes.length}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {verDivergentes ? "Clique para ocultar a lista" : "Clique para ver a lista"}
              </p>
            </button>
          </div>
        </aside>
      </section>

      {verDivergentes && (
        <section className="mx-auto max-w-7xl px-6 pb-12">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-foreground">
            Clientes com CTO divergente
          </h2>
          <div className="relative mb-4 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={buscaDivergentes}
              onChange={(e) => setBuscaDivergentes(e.target.value)}
              placeholder="Buscar por login ou caixa"
              className="pl-9"
              aria-label="Buscar clientes divergentes"
            />
          </div>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Login</TableHead>
                  <TableHead>Caixa cadastrada</TableHead>
                  <TableHead>Interface esperada</TableHead>
                  <TableHead className="text-right">Interface real</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {divergentesFiltrados.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                      Nenhuma divergência encontrada.
                    </TableCell>
                  </TableRow>
                ) : (
                  divergentesFiltrados.slice(0, 500).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.login}</TableCell>
                      <TableCell>{d.caixa}</TableCell>
                      <TableCell>{traduzirInterface(d.esperada)}</TableCell>
                      <TableCell className="text-right">{traduzirInterface(d.real)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {divergentesFiltrados.length} de {divergentes.length} clientes divergentes
          </p>
        </section>
      )}
    </main>
  );
}
