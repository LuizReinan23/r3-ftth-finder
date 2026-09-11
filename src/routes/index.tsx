import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search, X } from "lucide-react";
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
import { listCaixasFtth, listClientesFtth } from "@/lib/clientes.functions";
import { syncIxcClientes } from "@/lib/ixc.functions";
import { syncIxcCaixas } from "@/lib/ixc-caixas.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "R3 Internet — Clientes FTTH" },
      {
        name: "description",
        content:
          "Painel de consulta de clientes FTTH da R3 Internet: login, caixa e porta sincronizados com o IXC.",
      },
      { property: "og:title", content: "R3 Internet — Clientes FTTH" },
      {
        property: "og:description",
        content: "Consulte login, caixa e porta dos clientes FTTH da R3 Internet.",
      },
    ],
  }),
  component: Dashboard,
});

function formatarData(valor: string | null | undefined) {
  if (!valor) return "—";
  return new Date(valor).toLocaleString("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function corOcupacao(pct: number) {
  if (pct >= 100) return "bg-destructive text-destructive-foreground";
  if (pct >= 70) return "bg-warning text-warning-foreground";
  return "bg-success text-success-foreground";
}

function Dashboard() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");
  const [buscaCaixa, setBuscaCaixa] = useState("");
  const [caixaSelecionada, setCaixaSelecionada] = useState<string | null>(null);

  const listar = useServerFn(listClientesFtth);
  const listarCaixas = useServerFn(listCaixasFtth);
  const sincronizarClientes = useServerFn(syncIxcClientes);
  const sincronizarCaixas = useServerFn(syncIxcCaixas);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes_ftth"],
    queryFn: () => listar(),
  });

  const { data: caixas = [] } = useQuery({
    queryKey: ["caixas_ftth"],
    queryFn: () => listarCaixas(),
  });

  const sync = useMutation({
    mutationFn: async () => {
      const [rc, rx] = await Promise.allSettled([
        sincronizarClientes(),
        sincronizarCaixas(),
      ]);
      return { rc, rx };
    },
    onSuccess: ({ rc, rx }) => {
      if (rc.status === "fulfilled") {
        toast.success(`${rc.value.sincronizados} clientes sincronizados com o IXC.`);
      } else {
        toast.error(
          rc.reason instanceof Error ? rc.reason.message : "Falha ao sincronizar clientes.",
        );
      }
      if (rx.status === "fulfilled") {
        toast.success(`${rx.value.sincronizadas} caixas sincronizadas com o IXC.`);
      } else {
        toast.error(
          rx.reason instanceof Error ? rx.reason.message : "Falha ao sincronizar caixas.",
        );
      }
      queryClient.invalidateQueries({ queryKey: ["clientes_ftth"] });
      queryClient.invalidateQueries({ queryKey: ["caixas_ftth"] });
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

  const contagemPorCaixa = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const c of clientes) {
      const id = c.id_caixa_ftth;
      if (!id) continue;
      mapa.set(id, (mapa.get(id) ?? 0) + 1);
    }
    return mapa;
  }, [clientes]);

  const ranking = useMemo(() => {
    const termo = buscaCaixa.trim().toLowerCase();
    return caixas
      .map((caixa) => {
        const total = contagemPorCaixa.get(caixa.id) ?? 0;
        const capacidade = caixa.capacidade ?? 0;
        const pct = capacidade > 0 ? (total / capacidade) * 100 : null;
        return { ...caixa, total, capacidade, pct };
      })
      .filter((c) =>
        termo ? (c.descricao ?? c.id).toLowerCase().includes(termo) : true,
      )
      .sort((a, b) => {
        if (a.pct === null && b.pct === null) return b.total - a.total;
        if (a.pct === null) return 1;
        if (b.pct === null) return -1;
        return b.pct - a.pct;
      });
  }, [caixas, contagemPorCaixa, buscaCaixa]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    let base = clientes;
    if (caixaSelecionada) {
      base = base.filter((c) => c.id_caixa_ftth === caixaSelecionada);
    }
    if (!termo) return base;
    return base.filter((c) =>
      [c.login, c.id_caixa_ftth, c.ftth_porta]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo)),
    );
  }, [clientes, busca, caixaSelecionada]);

  const descricaoSelecionada = useMemo(() => {
    if (!caixaSelecionada) return null;
    const caixa = caixas.find((c) => c.id === caixaSelecionada);
    return caixa?.descricao ?? caixaSelecionada;
  }, [caixas, caixaSelecionada]);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-lg font-black tracking-tight text-primary-foreground"
            >
              R3
            </span>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">
                R3 Internet — Clientes FTTH
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

      <section className="mx-auto max-w-5xl px-6 pt-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Caixas mais lotadas</h2>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={buscaCaixa}
            onChange={(e) => setBuscaCaixa(e.target.value)}
            placeholder="Buscar caixa pela descrição"
            className="pl-9"
            aria-label="Buscar caixas"
          />
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border border-border bg-card">
          {ranking.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Nenhuma caixa encontrada. Use o botão Atualizar para sincronizar.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {ranking.map((caixa) => (
                <li key={caixa.id}>
                  <button
                    type="button"
                    onClick={() => setCaixaSelecionada(caixa.id)}
                    className={`flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-muted ${
                      caixaSelecionada === caixa.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {caixa.descricao ?? `Caixa ${caixa.id}`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {caixa.capacidade > 0
                          ? `${caixa.total} de ${caixa.capacidade} portas`
                          : `${caixa.total} clientes · sem capacidade cadastrada`}
                      </p>
                    </div>
                    {caixa.pct !== null ? (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${corOcupacao(caixa.pct)}`}
                      >
                        {Math.round(caixa.pct)}%
                      </span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                        —
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-8">
        {caixaSelecionada && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-sm text-foreground">
              Mostrando clientes da caixa <strong>{descricaoSelecionada}</strong>
            </p>
            <Button variant="outline" size="sm" onClick={() => setCaixaSelecionada(null)}>
              <X /> Limpar filtro
            </Button>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por login, caixa ou porta"
            className="pl-9"
            aria-label="Buscar clientes"
          />
        </div>

        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Login</TableHead>
                <TableHead>Caixa</TableHead>
                <TableHead>Porta</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Carregando clientes...
                  </TableCell>
                </TableRow>
              ) : filtrados.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    Nenhum cliente encontrado. Use o botão Atualizar para sincronizar.
                  </TableCell>
                </TableRow>
              ) : (
                filtrados.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.login}</TableCell>
                    <TableCell>{c.id_caixa_ftth ?? "—"}</TableCell>
                    <TableCell>{c.ftth_porta ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          c.status_ativo === "S"
                            ? "inline-flex items-center rounded-full bg-success px-2.5 py-0.5 text-xs font-semibold text-success-foreground"
                            : "inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground"
                        }
                      >
                        {c.status_ativo === "S" ? "Ativo" : "Inativo"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {filtrados.length} de {clientes.length} clientes
        </p>
      </section>
    </main>
  );
}
