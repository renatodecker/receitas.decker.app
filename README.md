# Receitas — Hub Decker

Área compartilhada (família/casa) para receitas e lista de compras, sem login — acesso por código da área (leitura) + PIN (escrita). Fase 1 (MVP).

## Stack

- Front: React + Vite + Tailwind, roteamento client-side (`HashRouter`).
- Backend: AWS Amplify Gen 2 (backend-as-code em `amplify/`) — DynamoDB single-table + 1 Lambda (Node.js 22) exposta via Function URL.
- Sem contas de usuário, sem AppSync/GraphQL: a Lambda expõe uma API REST simples (roteamento manual por método+path).

## Desenvolvimento local

```bash
npm install
npx ampx sandbox        # sobe um backend de sandbox na sua conta AWS e gera amplify_outputs.json
```

Copie a `apiUrl` de `amplify_outputs.json` (campo `custom.apiUrl`) para um arquivo `.env`:

```
VITE_API_URL=https://xxxxxxxx.lambda-url.us-east-1.on.aws
```

Depois:

```bash
npm run dev
```

## Deploy

Este app usa Amplify Hosting com backend-as-code (`amplify.yml` na raiz). Para publicar em `receita.decker.app.br`:

1. Conectar este repositório a um app do AWS Amplify Hosting (console) apontando para a branch `main`.
2. Configurar o domínio customizado `receita.decker.app.br` no app do Amplify Hosting.
3. Cada push em `main` roda `amplify.yml`: a fase `backend` provisiona a tabela DynamoDB e a Lambda via CDK (`amplify/backend.ts`) e gera `amplify_outputs.json`; a fase `frontend` lê a `apiUrl` de lá, grava em `.env` e builda o Vite.

Esses três passos de infraestrutura (criar o app no Amplify Hosting, ligar ao repo, configurar o domínio) precisam ser feitos uma vez no console AWS — não há como fazer isso via código neste repositório.

## Estrutura

```
src/                     front-end
  pages/                 telas (uma por rota)
  context/AreaContext    estado da área carregada (meta + receitas + lista)
  api/client.ts          cliente fetch da API
  lib/conversion/        módulo de conversão de medidas caseiras (isolado, reutilizável)
  lib/gerarLista.ts      agregação de ingredientes ao gerar lista a partir de receitas
amplify/
  backend.ts             infra: tabela DynamoDB + Function URL (CDK)
  functions/api/         código da Lambda (router + handlers + regras de negócio)
```
