# R3 FTTH Client Hub

Criar um app standalone: uma dashboard de consulta de clientes FTTH da R3 Internet (login, caixa e porta), integrada com a API do IXC. Não precisa ter nenhuma outra funcionalidade — é um projeto dedicado só a isso.

## Identidade visual
- Cores da marca R3: vermelho #D20911 como cor primária, preto/branco/cinza como base.
- Tela única e limpa, com logo/título "R3 Internet — Clientes FTTH" no topo.

## 1. Tabela no Supabase
Criar tabela `clientes_ftth`:
- `id` (uuid, PK, default gen_random_uuid())
- `login` (text, UNIQUE)
- `id_caixa_ftth` (text)
- `ftth_porta` (text)
- `status_ativo` (text) — "S" ou "N"
- `atualizado_em` (timestamptz, default now())
RLS: leitura liberada para usuários autenticados; escrita só via service role (edge function).

## 2. Edge Function `sync-ixc-clientes`
- Lê os secrets `IXC_USERNAME` e `IXC_PASSWORD` (nunca hardcoded).
- Faz POST autenticado (Basic Auth) para:
  `https://central.r3internet.com.br/webservice/v1/radusuarios`
  Header extra: `ixcsoft: listar`
  Body:
  ```json
  {
    "qtype": "radusuarios.ativo",
    "query": "S",
    "oper": "=",
    "page": "1",
    "rp": "20",
    "sortname": "radusuarios.id",
    "sortorder": "desc"
  }
  ```
- Pagina incrementando `page` até a resposta vir com menos registros que `rp` (ou vazia).
- Para cada registro, extrai `login`, `id_caixa_ftth`, `ftth_porta`, `ativo`, e faz upsert na tabela `clientes_ftth` (conflito por `login`), atualizando `atualizado_em`.
- Trata erros de autenticação (401/403) e timeout com mensagens claras, sem logar a senha.
- Retorna quantidade de registros sincronizados e o timestamp.

## 3. Tela única (Dashboard)
- Botão **"Atualizar"** no topo — dispara a Edge Function sob demanda (sem cron, sem auto-refresh).
- Estado de loading no botão durante a sincronização.
- Texto "Última atualização: [data/hora]" com o valor mais recente de `atualizado_em`.
- Tabela abaixo lendo direto de `clientes_ftth`, colunas: Login | Caixa | Porta | Status (badge verde "Ativo" / vermelho "Inativo").
- Campo de busca (client-side) filtrando por login, caixa ou porta.
- Contador "X de Y clientes" abaixo da tabela.

Não usar nenhuma credencial real no código — os valores de `IXC_USERNAME` e `IXC_PASSWORD` serão cadastrados por mim diretamente nos Secrets do Supabase depois que a function existir.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fc500de4-9e70-4a98-bd45-8da609d22040).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
