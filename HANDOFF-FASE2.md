# Hub de Receitas — Handoff técnico Fase 1 → Fase 2

> Documento autocontido: escrito para alimentar a especificação da Fase 2 em uma sessão sem acesso a este repositório nem ao arquivo de spec original da Fase 1.

## 1. Modelo de dados final no DynamoDB

Tabela única `receitas-app` (on-demand, sem GSI), provisionada via CDK em `amplify/backend.ts`.

- **Partition key:** `areaCodigo` (string) — ex.: `RCT-7K3MN`
- **Sort key:** `sk` (string) — um dos três formatos:
  - `"META"` — metadados da área (exatamente 1 por área)
  - `"RECEITA#<uuid>"` — uma receita
  - `"LISTA#<uuid>"` — a lista de compras (exatamente 1 por área nesta fase)

Toda a área é lida com **uma única Query** por `areaCodigo`.

### Item META
```
{
  areaCodigo: string,
  sk: "META",
  pinHash: string,          // bcrypt (bcryptjs, 10 rounds)
  nome: string | null,      // nome da área, opcional
  criadaEm: string,         // ISO 8601
  pinFailCount: number,     // tentativas de PIN incorretas consecutivas
  pinLockedUntil: string | null  // ISO 8601 do fim do bloqueio, ou null
}
```
`pinFailCount`/`pinLockedUntil` **não estavam no modelo da spec original** — foram adicionados para implementar o rate limit de 5 erros → 15 min de bloqueio exigido. Ver seção 7.

### Item RECEITA
```
{
  areaCodigo: string,
  sk: "RECEITA#<uuid>",
  receitaId: string,        // mesmo uuid do sk, duplicado para facilitar o front
  nome: string,
  modoPreparo: string,
  tags: string[],           // sempre [] nesta fase — não há UI para preenchê-las
  ingredientes: [{ nome: string (lowercase+trim), quantidade: number, unidade: Unidade }],
  criadaEm: string          // ISO 8601
}
```

### Item LISTA
```
{
  areaCodigo: string,
  sk: "LISTA#<uuid>",
  listaId: string,          // mesmo uuid do sk
  nome: string,              // sempre "Lista de compras" nesta fase (sem UI para renomear)
  itens: [{
    itemId: string,          // uuid
    nome: string,
    quantidade: number,
    unidade: Unidade,
    status: "ativo" | "comprado",
    compradoEm: string | null,   // ISO 8601, setado só quando status vira "comprado"
    origemReceitaId: string | null
  }]
}
```

`Unidade` = `"g" | "kg" | "ml" | "l" | "xicara" | "colher_sopa" | "colher_cha" | "unidade" | "pitada"` (igual à spec original, sem mudanças).

**Mutação de itens da lista é sempre "read full array, write full array"**: toda operação que muda `itens` (gerar, mudar status, limpar) lê o item LISTA inteiro e regrava o array `itens` completo com `SET itens = :itens`. Não há update por índice/elemento. Isso é suficiente porque não há concorrência simultânea tratada nesta fase (last-write-wins, conforme escopo).

## 2. Contrato de rotas final da Lambda

Uma única Lambda (Node.js 22, `amplify/functions/api/handler.ts`) exposta via **Function URL** (`authType: NONE`, CORS nativo liberando `content-type` e `x-area-pin`). Roteamento manual por `method` + `rawPath` em `amplify/functions/api/router.ts` — sem framework HTTP.

Formato de erro padrão (todo erro 4xx/5xx segue este shape):
```json
{ "erro": "codigo_maquina", "mensagem": "Texto em pt-BR para exibir ao usuário" }
```

| Rota | Método | Auth | Body | Resposta 2xx |
|---|---|---|---|---|
| `/area` | POST | — | `{ pin: string, nome?: string }` | `201 { codigo: string }` |
| `/area/{codigo}` | GET | — | — | `200 { meta: {codigo,nome,criadaEm}, receitas: Receita[], lista: Lista }` |
| `/area/{codigo}/receita` | POST | PIN | `{ nome, modoPreparo, ingredientes: Ingrediente[] }` | `201 Receita` |
| `/area/{codigo}/receita/{id}` | PUT | PIN | idem POST | `200 Receita` |
| `/area/{codigo}/receita/{id}` | DELETE | PIN | — | `200 { ok: true }` |
| `/area/{codigo}/lista/gerar` | POST | PIN | `{ itens: ItemLista[] }` (array **completo e já mesclado**, calculado no cliente) | `200 Lista` |
| `/area/{codigo}/lista/item/{id}` | PUT | PIN | `{ status: "ativo" \| "comprado" }` | `200 Lista` |
| `/area/{codigo}/lista/limpar` | POST | PIN | — | `200 { removidos: number, ...Lista }` |

PIN vai no header `X-Area-Pin` em toda rota marcada "PIN". Ausência/erro de PIN: `401 pin_ausente` ou `401 pin_invalido`. Bloqueio por rate limit: `403 bloqueado`. Área/receita/item inexistente: `404`. Validação de payload: `400` com código específico (`nome_invalido`, `ingredientes_invalidos`, `itens_invalidos`, `status_invalido`, etc). Erro não tratado: `500 erro_interno`.

**Desvio importante quanto a `/lista/gerar`:** ver seção 7 — o corpo carrega o array final já calculado pelo cliente, não uma lista de `receitaIds`.

## 3. Estrutura de pastas do repositório

```
receitas.decker.app/
├── amplify.yml                    # build spec do Amplify Hosting (backend + frontend)
├── amplify/
│   ├── backend.ts                 # CDK: tabela DynamoDB + Function URL + IAM
│   ├── tsconfig.json
│   └── functions/api/
│       ├── resource.ts            # defineFunction (Node 22, entry handler.ts)
│       ├── handler.ts             # entrypoint Lambda: parse do evento, chama o router
│       ├── router.ts              # roteamento method+path -> handlers
│       ├── db.ts                  # wrapper fino do DynamoDB DocumentClient
│       ├── pin.ts                 # hash/verificação de PIN + rate limit
│       ├── codigoArea.ts          # gerador do código RCT-XXXXX
│       ├── validacao.ts           # validação de payloads + classe ErroValidacao
│       ├── types.ts               # tipos dos itens DynamoDB (duplicados de src/types.ts
│       │                          #   de propósito — cada função Amplify é autocontida)
│       └── handlers/
│           ├── area.ts            # criarArea, obterArea
│           ├── receita.ts         # criar/editar/excluirReceita
│           └── lista.ts           # gerar/mudarStatus/limparComprados
├── src/
│   ├── main.tsx / App.tsx         # bootstrap + rotas (react-router-dom, HashRouter)
│   ├── types.ts                   # tipos de domínio compartilhados no front
│   ├── vite-env.d.ts
│   ├── api/client.ts              # cliente fetch (uma função por rota da Lambda)
│   ├── context/AreaContext.tsx    # carrega GET /area/:codigo, guarda meta+receitas+lista
│   │                              #   em contexto React, expõe setters otimistas
│   ├── lib/
│   │   ├── conversion/            # módulo de conversão — ver seções 5 e 6
│   │   ├── gerarLista.ts          # agregação de ingredientes de receitas -> itens de lista
│   │   ├── storage.ts             # sessão (código+PIN) em localStorage
│   │   ├── whatsapp.ts            # monta links wa.me
│   │   ├── unidades.ts            # labels de unidade + formatação de quantidade
│   │   └── numero.ts              # parse de quantidade digitada (vírgula ou ponto)
│   └── pages/
│       ├── Home.tsx               # entrar / criar área
│       ├── AreaLayout.tsx         # header + tabs (Receitas | Lista) + <Outlet/>
│       ├── ReceitasLista.tsx      # tab "Receitas" (index route da área)
│       ├── ReceitaForm.tsx        # criar E editar (mesma tela, decide pelo :receitaId)
│       ├── ReceitaDetalhe.tsx
│       ├── GerarLista.tsx         # seleção de receitas -> gera itens
│       └── ListaCompras.tsx       # tab "Lista de compras" (timer/desfazer de 5s)
├── public/favicon.svg
├── package.json                   # front + backend-as-code no MESMO package.json
│                                  #   (padrão Amplify Gen2: um projeto, um pacote)
├── vite.config.ts, tailwind.config.js, postcss.config.js
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── README.md
```

## 4. Decisões tomadas em pontos delegados pela spec da Fase 1

**Mapa de telas/navegação** — `HashRouter` (URLs `#/area/RCT-XXXXX/...`), decisão explicada na seção 7. Rotas:
- `/` → Home (entrar com código+PIN, ou criar área)
- `/area/:codigo` → layout com header (código, nome, compartilhar, sair) + 2 tabs
  - índice → lista de receitas
  - `/receitas/nova`, `/receitas/:id`, `/receitas/:id/editar`
  - `/lista` → lista de compras
  - `/lista/gerar` → seleção de receitas para gerar itens

**Validações e limites** (todos aplicados na Lambda, em `validacao.ts`):
- PIN: 4 a 6 dígitos numéricos.
- Nome da receita: 1–120 caracteres. Nome da área: até 80. Modo de preparo: até 5000 caracteres.
- Ingredientes por receita: 1 a 100 linhas; nome do ingrediente 1–80 caracteres; quantidade numérica finita, `0 < quantidade ≤ 100000`; unidade precisa estar no enum.
- Itens de lista: array de até 500 itens por chamada de `/lista/gerar` ou nas respostas.
- Nome do ingrediente é normalizado (`trim` + `lowercase`) ao persistir, para casar com a tabela de conversão.

**Formato de quantidade aceito**: número decimal positivo. No campo de formulário o usuário pode digitar vírgula ou ponto como separador decimal (`1,5` ou `1.5`) — `src/lib/numero.ts` normaliza antes de validar/enviar. Não há suporte a frações (`1/2`) nem a texto livre ("a gosto"); ingredientes sem quantidade definida precisam de um valor numérico mesmo que aproximado.

**Textos principais** (pt-BR, tom direto e não infantilizado, pensado para uso no mercado/celular):
- Home: "Receitas — Receitas e lista de compras da família, sem login." / botões "Entrar em uma área" e "Criar nova área".
- Aviso na criação de área: "O PIN é necessário para cadastrar receitas e mexer na lista. Não existe recuperação — se perder o PIN, a área fica só para leitura."
- Confirmação de exclusão de receita: `Excluir a receita "{nome}"? Essa ação não pode ser desfeita.` (via `window.confirm` nativo)
- Confirmação de limpar comprados: `Excluir N itens comprados? Essa ação não pode ser desfeita.` (texto exato pedido pela spec da Fase 1)
- Texto de compartilhamento da lista: `🛒 Lista de compras\n- Item (quantidade+unidade)...` (formato exigido pela spec, implementado em `lib/whatsapp.ts`).

**Identidade visual**:
- Cor primária: **verde-erva** (`primary`, Tailwind custom palette, tom principal `#56762b` / `primary-600`).
- Cor de destaque (ações de "avançar"/CTA secundário, ex. botão de gerar lista, adicionar à lista): terracota (`accent`, tom principal `#d95f22` / `accent-500`).
- Fonte: `Nunito` (declarada em `tailwind.config.js` como `font-sans`; **a fonte em si não foi embarcada** — ver seção 8, é um pendência).
- Corpo em 16px (`text-base` do Tailwind), áreas de toque dos itens de lista e botões com `min-h-[44px]`.

## 5. Estrutura do JSON de conversão

Arquivo: `src/lib/conversion/data.json`. Array de objetos, **73 ingredientes** curados.

```json
{
  "ingrediente": "farinha de trigo",
  "unidadeBase": "g",
  "densidade": 0.53,
  "equivalencias": { "xicara": 120, "colher_sopa": 7.5, "colher_cha": 2.5 },
  "fonte": "IBGE"
}
```

- `ingrediente`: chave de busca, já normalizada (lowercase, sem acento, sem caracteres especiais — ex. `"acucar refinado"`, `"grao de bico cru"`).
- `unidadeBase`: **campo adicionado além da spec original** — `"g"` ou `"ml"`, define para qual unidade o ingrediente converte por padrão (farinhas/açúcares/grãos → g; líquidos → ml). Ver seção 7.
- `densidade`: g/ml, usada para converter `ml`/`l` ⇄ `g`/`kg`.
- `equivalencias`: gramas por medida de volume caseira (curadas, não derivadas por fórmula de `densidade × volume` — refletem compactação/aeração reais).
- `fonte`: uma de `IBGE`, `TACO`, `Pinheiro`, `USDA`, `Nestle-Receiteria`, na ordem de prioridade definida na spec.

**Categorias cobertas** (73 itens): farinhas e amidos (10), açúcares e adoçantes (6), grãos/cereais (7), laticínios e derivados (11), gorduras/óleos (5), líquidos diversos (5), itens de confeitaria/fermentação (5), sal (2), oleaginosas/sementes (8), molhos/condimentos (4), temperos secos (6), diversos (4).

**Nota de proveniência**: as tentativas de acessar ao vivo as páginas de referência (IBGE/POF, Nestlé, Deliway, Cozinhei, MenuControl) retornaram HTTP 403 (bloqueio anti-bot) durante esta sessão — os valores foram curados a partir de conhecimento consolidado de tabelas de equivalência caseira brasileiras amplamente publicadas e consistentes entre si (os três exemplos citados literalmente na spec da Fase 1 — farinha de trigo 120g/xícara, açúcar refinado 200g/xícara, leite condensado 300g/xícara — foram usados como âncora de calibração). **Não houve verificação linha a linha contra o PDF oficial do IBGE**; isso é uma dívida técnica explícita (seção 8).

## 6. Interface pública do módulo de conversão

Módulo em `src/lib/conversion/` — **zero dependências de framework** (não importa React nem nada do resto do app além de `../../types` indiretamente via re-export de tipos), pensado para ser extraído como pacote/app standalone na Fase 2.

```ts
// src/lib/conversion/normalizar.ts
function normalizarNomeIngrediente(nome: string): string
// lowercase, sem diacríticos, trim, espaços colapsados

// src/lib/conversion/index.ts
function buscarConversao(nomeIngrediente: string): IngredienteConversao | undefined
function listarIngredientesSuportados(): string[]
// lista de todos os `ingrediente` (já normalizados) presentes na tabela

function converterParaBase(
  nomeIngrediente: string,
  quantidade: number,
  unidade: UnidadeQualquer,  // 'g'|'kg'|'ml'|'l'|'xicara'|'colher_sopa'|'colher_cha'|'unidade'|'pitada'
): ResultadoConversao | null
// Retorna null quando o ingrediente não está na tabela OU a unidade não é
// conversível (unidade/pitada) — nesses casos o chamador deve manter a
// linha original em vez de arriscar uma conversão incorreta.

// tipos exportados
interface IngredienteConversao {
  ingrediente: string;
  unidadeBase: 'g' | 'ml';
  densidade: number;
  equivalencias: { xicara: number; colher_sopa: number; colher_cha: number };
  fonte: string;
}
interface ResultadoConversao {
  valor: number;
  unidade: 'g' | 'ml';
  ingrediente: IngredienteConversao;
}
```

A lógica de **agregação entre receitas** (somar múltiplos ingredientes convertidos, mesclar com itens já ativos na lista) **não faz parte deste módulo** — vive em `src/lib/gerarLista.ts`, que consome `converterParaBase`/`normalizarNomeIngrediente` mas contém regra de negócio específica do app de receitas (merge com lista existente), não do conversor genérico. Se a Fase 2 extrair o conversor como app standalone, `gerarLista.ts` fica para trás.

## 7. Desvios desta spec e motivo

1. **Contradição na spec original sobre persistência do PIN, resolvida a favor de salvar em claro no localStorage.** O texto continha duas instruções conflitantes: "Front pode manter PIN em memória de sessão; nunca persistir em claro" (seção de modelo de acesso) vs. "código e PIN salvos em localStorage (PIN em claro — risco aceito...)" (seção de arquitetura). Implementei a segunda, por ser mais específica/detalhada e por habilitar o requisito explícito "reabrir cai direto na área". A defesa continua sendo o rate limit de 5 tentativas na Lambda, não a proteção do PIN no dispositivo.
2. **`/area/{codigo}/lista/gerar` recebe o array de itens já mesclado, não `receitaIds`.** A spec diz "conversão roda client-side; Lambda persiste resultado já calculado" — levei isso ao extremo: toda a lógica de agrupamento/conversão/merge-com-lista-existente roda no cliente (`gerarLista.ts`), e a Lambda só valida PIN e regrava o array. Isso simplifica a Lambda (sem precisar embarcar a tabela de conversão no backend) mas significa que o endpoint não é idempotente por `receitaIds` — cada chamada carrega o estado final desejado.
3. **`unidadeBase` adicionado a cada entrada da tabela de conversão.** A spec não previa esse campo explicitamente; foi necessário decidir, por ingrediente, se o resultado consolidado deve ser em `g` ou `ml` (ex.: farinha → g, leite → ml). Sem esse campo não daria para escolher a unidade final de forma determinística.
4. **Regra de merge de itens não-conversíveis, interpretada literalmente e talvez contra-intuitiva.** A spec diz: item ativo existente + unidade conversível → soma; comprado OU unidade não-conversível → linha nova. Implementei isso ao pé da letra: ingredientes em `unidade`/`pitada` (ex. "2 ovos") **nunca** se fundem com uma linha já existente na lista, nem entre gerações sucessivas — cada "Gerar lista" repetida cria uma linha nova de "Ovos", mesmo que já exista uma ativa. Isso foi verificado em teste manual e é o comportamento literal da regra escrita, mas pode surpreender o usuário (esperaria ver os ovos somados). Dentro do mesmo lote de geração (mesma chamada, múltiplas receitas selecionadas), ingredientes não-conversíveis de nome+unidade idênticos SÃO somados entre si — essa parte foi uma decisão minha para dar uma UX razoável, não estava escrita na spec.
5. **`HashRouter` em vez de rotas "limpas" (`BrowserRouter`).** Deploy em Amplify Hosting normalmente exige uma regra de rewrite (`/<^[^.]+$>` → `/index.html`, 200) configurada no console para SPAs com rotas client-side — configuração que não é possível fazer via código neste repositório. Usar `HashRouter` (`/#/area/...`) evita depender dessa configuração manual; troca "URLs bonitas" por deploy garantido sem passo manual extra.
6. **Sem verificação ao vivo das fontes da tabela de conversão** (WebFetch bloqueado com 403 em todas as páginas tentadas: Nestlé, Deliway, Cozinhei, MenuControl). Valores curados por conhecimento consolidado, não por conferência linha a linha do PDF do IBGE/POF. Ver dívida técnica na seção 8.
7. **PIN hasheado com `bcryptjs` (puro JS), não `bcrypt` nativo.** A spec pedia "bcrypt/argon2"; usei a variante pura-JS para evitar problemas de bundling de módulo nativo no empacotamento da Lambda pelo `ampx`/esbuild. Segurança equivalente (mesmo algoritmo), custo de CPU um pouco maior — irrelevante no volume de uso esperado (app doméstico).
8. **Exclusão de receita não faz cascade nos itens da lista.** Um item de lista com `origemReceitaId` apontando para uma receita já excluída fica "órfão" (a referência simplesmente não resolve mais a nada). A spec não define esse comportamento; optei por não fazer cascade porque o item da lista já é um "snapshot" independente (mesma lógica de snapshot de conversão da spec) — apagar a receita não deveria apagar retroativamente o que já foi para a lista de compras.

## 8. Pendências e dívidas técnicas

1. **Deploy real em `receita.decker.app.br` não foi executado nesta sessão.** O ambiente de execução usado para este trabalho não tinha AWS CLI nem credenciais reais da conta AWS (apenas placeholders de proxy) — não há como rodar `npx ampx sandbox`/`pipeline-deploy` de verdade nem criar o app no Amplify Hosting/conectar o domínio a partir daqui. **Passos que faltam, a serem feitos manualmente no console AWS:** (a) criar um app no Amplify Hosting apontando para este repositório/branch `main`; (b) configurar o domínio customizado `receita.decker.app.br`; (c) primeira execução do pipeline vai provisionar a tabela DynamoDB e a Lambda via `amplify.yml`. Só depois disso o app fica de fato no ar. Tudo que pôde ser verificado localmente foi: `npm install`, `tsc -b` (typecheck limpo, front + `amplify/`), `vite build` (build de produção ok), bundle da Lambda via `esbuild` (sem imports quebrados), e testes manuais em Node do módulo de conversão e da agregação de lista (`gerarLista.ts`) com dados de exemplo.
2. **Tabela de conversão não verificada linha a linha contra fontes primárias** (ver seção 7, item 6). Antes de confiar nela para uso real, vale conferir pelo menos os itens mais usados (arroz, feijão, farinha, açúcar, óleo, manteiga) contra o PDF do IBGE/POF 2008-2009 ou o livro do Pinheiro et al.
3. **Fonte tipográfica "Nunito" declarada mas não embarcada.** `tailwind.config.js` referencia `Nunito` em `font-sans`, mas nenhum `@font-face`/link do Google Fonts foi adicionado — hoje o navegador cai no fallback `system-ui`. Ou embarcar a fonte (self-host, evitando dependência de CDN externo) ou trocar a declaração para uma fonte de sistema explícita.
4. **Sem testes automatizados.** Toda verificação desta fase foi manual (build + scripts ad-hoc via esbuild/node). Não há suite de testes unitários para o módulo de conversão, `gerarLista.ts`, nem para os handlers da Lambda.
5. **Rate limit de PIN é por área, não por IP/dispositivo.** Um atacante que descobra o código da área (formato curto, 5 caracteres) ainda tem só 5 tentativas antes do bloqueio de 15 min, mas nada impede tentativas distribuídas de descobrir códigos de área válidos por força bruta (não há rate limit na criação de área nem no GET de leitura). Aceitável para o caso de uso (app doméstico, sem dados sensíveis), mas vale registrar.
6. **`gerarLista.ts` roda os cálculos de conversão inteiramente no cliente e manda o array final pronto para a Lambda persistir.** Isso funciona bem para um único dispositivo escrevendo por vez, mas dois dispositivos gerando lista "ao mesmo tempo" a partir do mesmo estado desatualizado vão se sobrescrever (last-write-wins, escopo aceito pela spec) — só chamando a atenção porque o "cálculo no cliente" torna esse cenário um pouco mais provável (a janela entre ler o estado e escrever o resultado calculado é maior do que seria com lógica 100% no servidor).
