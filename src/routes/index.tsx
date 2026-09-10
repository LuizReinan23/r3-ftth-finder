import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Loader2, RefreshCw, Search } from "lucide-react";
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
import { listClientesFtth } from "@/lib/clientes.functions";
import { syncIxcClientes } from "@/lib/ixc.functions";

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

function Dashboard() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");

  const listar = useServerFn(listClientesFtth);
  const sincronizar = useServerFn(syncIxcClientes);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes_ftth"],
    queryFn: () => listar(),
  });

  const sync = useMutation({
    mutationFn: () => sincronizar(),
    onSuccess: (resultado) => {
      toast.success(`${resultado.sincronizados} clientes sincronizados com o IXC.`);
      queryClient.invalidateQueries({ queryKey: ["clientes_ftth"] });
    },
    onError: (erro: Error) => toast.error(erro.message || "Falha ao sincronizar."),
  });

  const ultimaAtualizacao = useMemo(() => {
    if (clientes.length === 0) return null;
    return clientes.reduce<string | null>(
      (maior, c) => (!maior || c.atualizado_em > maior ? c.atualizado_em : maior),
      null,
    );
  }, [clientes]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return clientes;
    return clientes.filter((c) =>
      [c.login, c.id_caixa_ftth, c.ftth_porta]
        .filter(Boolean)
        .some((campo) => String(campo).toLowerCase().includes(termo)),
    );
  }, [clientes, busca]);

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
            {sync.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <RefreshCw />
            )}
            {sync.isPending ? "Atualizando..." : "Atualizar"}
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-8">
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
