# Hub de Receitas — Handoff técnico Fase 1 → Fase 2

> Documento autocontido: escrito para alimentar a especificação da Fase 2 em uma sessão sem acesso a este repositório, à spec original da Fase 1, nem a qualquer conversa anterior. Tudo que a Fase 2 precisa saber sobre o que existe hoje está aqui.

## Status

App em produção em **https://receita.decker.app.br**. Backend rodando em **`us-east-1`** (não em `sa-east-1`/São Paulo — motivo na seção 7, item 1). Repositório GitHub `renatodecker/receitas.decker.app`, tudo na branch `main`.

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
`pinFailCount` e `pinLockedUntil` não estavam no modelo da spec original da Fase 1 — foram adicionados para implementar o rate limit de 5 erros consecutivos → 15 min de bloqueio, exigido pela spec mas sem modelo de dados definido para isso.

### Item RECEITA
```
{
  areaCodigo: string,
  sk: "RECEITA#<uuid>",
  receitaId: string,        // mesmo uuid do sk, duplicado para facilitar o front
  nome: string,
  modoPreparo: string,
  tags: string[],           // sempre [] nesta fase — sem UI para preenchê-las
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

`Unidade` = `"g" | "kg" | "ml" | "l" | "xicara" | "colher_sopa" | "colher_cha" | "unidade" | "pitada"` — igual à spec original, sem mudanças.

**Mutação de itens da lista é sempre "read full array, write full array"**: toda operação que muda `itens` (gerar, mudar status, limpar) lê o item LISTA inteiro e regrava o array `itens` completo com `SET itens = :itens`. Não há update por índice/elemento. Isso é suficiente porque não há concorrência simultânea tratada nesta fase (last-write-wins, conforme escopo).

## 2. Contrato de rotas final da Lambda

Uma única Lambda (Node.js 22, `amplify/functions/api/handler.ts`) exposta via **Function URL** (`authType: NONE`, CORS nativo liberando os headers `content-type` e `x-area-pin`). Roteamento manual por `method` + `rawPath` em `amplify/functions/api/router.ts` — sem framework HTTP.

Formato de erro padrão (todo erro 4xx/5xx segue este shape):
```json
{ "erro": "codigo_maquina", "mensagem": "Texto em pt-BR para exibir ao usuário" }
```

| Rota | Método | Auth | Body | Resposta 2xx |
|---|---|---|---|---|
| `/area` | POST | — | `{ nome?: string }` | `201 { codigo: string, pin: string }` |
| `/area/{codigo}` | GET | — | — | `200 { meta: {codigo,nome,criadaEm}, receitas: Receita[], lista: Lista }` |
| `/area/{codigo}/verificar-pin` | POST | PIN | — | `200 { ok: true }` |
| `/area/{codigo}/receita` | POST | PIN | `{ nome, modoPreparo, ingredientes: Ingrediente[] }` | `201 Receita` |
| `/area/{codigo}/receita/{id}` | PUT | PIN | idem POST | `200 Receita` |
| `/area/{codigo}/receita/{id}` | DELETE | PIN | — | `200 { ok: true }` |
| `/area/{codigo}/lista/gerar` | POST | PIN | `{ itens: ItemLista[] }` (array **completo e já mesclado**, calculado no cliente) | `200 Lista` |
| `/area/{codigo}/lista/item/{id}` | PUT | PIN | `{ status: "ativo" \| "comprado" }` | `200 Lista` |
| `/area/{codigo}/lista/limpar` | POST | PIN | — | `200 { removidos: number, ...Lista }` |

Detalhes de cada rota:

- **`POST /area`** — cria a área. O corpo **não** inclui PIN: o servidor gera um PIN numérico de 6 dígitos (`crypto.randomInt`, em `amplify/functions/api/pin.ts:gerarPin`), guarda só o hash (bcrypt) e devolve o PIN em texto puro **uma única vez**, nesta resposta. Não há como recuperá-lo depois. Gera também o `codigo` (formato `RCT-XXXXX`, ver `codigoArea.ts`) com retry em caso de colisão (até 5 tentativas), e cria junto o item LISTA vazio da área (exatamente 1 lista por área, criada automaticamente).
- **`GET /area/{codigo}`** — não exige PIN (acesso de leitura é público a quem tiver o código). Retorna meta + todas as receitas + a lista, numa query só. 404 se a área não existir.
- **`POST /area/{codigo}/verificar-pin`** — recebe o PIN só no header `X-Area-Pin`, sem body. Reaproveita a mesma função de verificação (`verificarPin`) usada pelas rotas de escrita — inclusive o rate limit — mas **não muda nenhum dado**. Existe para o front poder oferecer um botão "Desbloquear edição" que confirma o PIN antes de liberar a UI de escrita, sem precisar disparar uma mutação real só para testar o PIN.
- **`POST/PUT/DELETE` de receita e as três rotas de lista** — todas exigem `X-Area-Pin` e passam pela mesma `verificarPin()`.

PIN vai no header `X-Area-Pin` em toda rota marcada "PIN" na tabela. Validação/erros:
- PIN ausente: `401 { erro: "pin_ausente" }`
- PIN incorreto: `401 { erro: "pin_invalido" }`
- Bloqueado por rate limit (5 erros consecutivos): `403 { erro: "bloqueado", mensagem: "...Tente novamente em N min." }`, bloqueio de 15 min
- Área/receita/item inexistente: `404` com `erro` específico (`area_nao_encontrada`, `receita_nao_encontrada`, `lista_nao_encontrada`, `item_nao_encontrado`)
- Validação de payload: `400` com código específico (`nome_invalido`, `ingredientes_invalidos`, `itens_invalidos`, `status_invalido`, `erro_gerar_codigo`, `json_invalido`)
- Erro não tratado: `500 { erro: "erro_interno" }`

## 3. Estrutura de pastas do repositório

```
receitas.decker.app/
├── amplify.yml                    # build spec do Amplify Hosting (backend + frontend)
├── .npmrc                          # legacy-peer-deps=true (ver seção 7, item 2)
├── amplify/
│   ├── backend.ts                 # CDK: tabela DynamoDB + Function URL + IAM
│   ├── tsconfig.json
│   ├── package.json               # { "type": "module" }
│   └── functions/api/
│       ├── resource.ts            # defineFunction (Node 22, entry handler.ts)
│       ├── handler.ts             # entrypoint Lambda: parse do evento, chama o router
│       ├── router.ts              # roteamento method+path -> handlers
│       ├── db.ts                  # wrapper fino do DynamoDB DocumentClient (get/put/query/update/delete)
│       ├── pin.ts                 # gerarPin, gerarHashPin, verificarPin (+ rate limit)
│       ├── codigoArea.ts          # gerador do código RCT-XXXXX
│       ├── validacao.ts           # validação de payloads + classe ErroValidacao
│       ├── types.ts               # tipos dos itens DynamoDB (duplicados de src/types.ts
│       │                          #   de propósito — cada função Amplify é autocontida)
│       └── handlers/
│           ├── area.ts            # criarArea, obterArea, verificarPinArea
│           ├── receita.ts         # criarReceita, editarReceita, excluirReceita
│           └── lista.ts           # gerarItensLista, mudarStatusItem, limparComprados
├── src/
│   ├── main.tsx                   # bootstrap React + import de efeito colateral do cookie banner
│   ├── App.tsx                    # rotas (react-router-dom, HashRouter)
│   ├── types.ts                   # tipos de domínio compartilhados no front
│   ├── vite-env.d.ts
│   ├── api/
│   │   └── client.ts              # cliente fetch — uma função por rota da Lambda, com ApiError
│   ├── components/
│   │   └── HubIcon.tsx            # ícone do hub decker.app.br, link para a home do hub
│   ├── context/
│   │   └── AreaContext.tsx        # carrega GET /area/:codigo; expõe codigo, pin, somenteLeitura,
│   │                              #   meta, receitas, lista, recarregar(), atualizarLista(),
│   │                              #   atualizarReceitas(), desbloquear(pin), voltarInicio()
│   ├── lib/
│   │   ├── conversion/            # módulo de conversão de medidas — ver seções 5 e 6
│   │   │   ├── data.json
│   │   │   ├── index.ts
│   │   │   ├── normalizar.ts
│   │   │   └── types.ts
│   │   ├── gerarLista.ts          # agregação de ingredientes de receitas -> itens de lista
│   │   ├── areasConhecidas.ts     # áreas conhecidas neste aparelho (localStorage) — ver seção 4
│   │   ├── formatoCodigo.ts       # normalizarCodigo / isCodigoValido (formato RCT-XXXXX)
│   │   ├── decker-cookie-consent.js  # script vanilla do hub: cookie banner LGPD + GA4 — ver seção 4
│   │   ├── whatsapp.ts            # monta links wa.me (área e lista)
│   │   ├── unidades.ts            # labels de unidade + formatação de quantidade para exibição
│   │   └── numero.ts              # parse de quantidade digitada (aceita vírgula ou ponto)
│   └── pages/
│       ├── Home.tsx               # "Minhas áreas" + acessar por código + criar nova área
│       ├── AreaLayout.tsx         # header (ícone hub, nome/código, compartilhar, desbloquear) + tabs
│       ├── ReceitasLista.tsx      # tab "Receitas" (rota índice da área)
│       ├── ReceitaForm.tsx        # criar E editar receita (mesma tela, decide pelo :receitaId)
│       ├── ReceitaDetalhe.tsx
│       ├── GerarLista.tsx         # seleção de receitas -> gera itens de lista
│       └── ListaCompras.tsx       # tab "Lista de compras" — timer/desfazer de 5s
├── public/
│   ├── favicon.svg                # ícone próprio do app (verde, "R") — distinto do ícone do hub
│   ├── og-image.png               # imagem de preview social gerada (1200x630)
│   ├── robots.txt
│   └── sitemap.xml
├── package.json                   # front + backend-as-code no MESMO package.json
│                                  #   (padrão Amplify Gen2: um projeto, um pacote)
├── vite.config.ts, tailwind.config.js, postcss.config.js
├── tsconfig.json / tsconfig.app.json (allowJs:true — ver seção 4) / tsconfig.node.json
└── README.md
```

## 4. Decisões tomadas em pontos delegados pela spec da Fase 1

**Modelo de acesso leitura/escrita:**
- Acessar uma área por código abre em **modo leitura**, sem pedir PIN — qualquer um com o código pode ver receitas e a lista.
- Dentro da área, se ainda não desbloqueada, aparece um aviso "Modo leitura" com botão **"Desbloquear edição"**: pede o PIN, chama `POST /area/{codigo}/verificar-pin`, e se válido o PIN passa a ficar disponível no `AreaContext` (`somenteLeitura` vira `false`) para o resto da visita.
- Todas as ações de escrita (nova receita, editar, excluir, marcar item comprado, gerar lista, limpar comprados) ficam **ocultas** enquanto a área está em modo leitura; as rotas de formulário (`ReceitaForm`, `GerarLista`) redirecionam de volta pra área se acessadas diretamente sem PIN desbloqueado.

**Persistência local — "Minhas áreas":**
Uma lista de até 20 áreas conhecidas neste aparelho, em `localStorage` (`src/lib/areasConhecidas.ts`, chave `receitas-decker:areas`), cada entrada `{ codigo, pin: string|null, nome: string|null }` — `pin: null` significa área conhecida só em modo leitura (nunca desbloqueada neste aparelho). A Home mostra essa lista com badge **Leitor**/**Editor**, botão **Abrir** e um **×** pra esquecer a área (não afeta a área em si no servidor, só a lista local do aparelho). Essa gravação é tratada como **funcionalidade essencial**, sem pedir consentimento — replica o padrão já usado por outro app do mesmo hub (álbum de figurinhas), que faz o mesmo.

**Mapa de telas/navegação** — `HashRouter` (URLs `#/area/RCT-XXXXX/...`; motivo na seção 7, item 8):
- `/` → Home: lista "Minhas áreas" (se houver alguma) + formulário "Acessar área" (só código) + botão "Criar nova área"
- `/area/:codigo` → layout com header (ícone do hub, nome/código da área, botão compartilhar, link "Minhas áreas") + aviso de modo leitura quando aplicável + 2 abas:
  - índice (`/area/:codigo`) → lista de receitas, com botões "Nova receita" e "Gerar lista" (só em modo edição)
  - `/area/:codigo/receitas/nova` e `/area/:codigo/receitas/:id/editar` → formulário de receita
  - `/area/:codigo/receitas/:id` → detalhe da receita
  - `/area/:codigo/lista` → lista de compras
  - `/area/:codigo/lista/gerar` → seleção de receitas para gerar itens de lista

**PIN — geração e formato:** sempre 6 dígitos numéricos, **gerado pelo servidor** (não escolhido pelo usuário) na criação da área. Mostrado em texto puro uma única vez, numa tela de confirmação pós-criação, com botão "Copiar". Sem recuperação: perdido o PIN — e não estando salvo como "Editor" em nenhum aparelho — a área vira permanentemente só-leitura.

**Compartilhamento:**
- Da área: botão "Compartilhar" no header abre um pequeno painel com checkbox "Incluir PIN no link" (desabilitado se a área ainda estiver em modo leitura neste aparelho) antes de montar o link `wa.me`.
- Da lista: botão "Compartilhar" na aba de lista monta o texto formatado (`🛒 Lista de compras\n- Item (quantidade+unidade)...`) com os itens ativos, sem PIN (não faz sentido incluir PIN num texto de itens).

**Validações e limites** (todos aplicados na Lambda, em `validacao.ts`):
- PIN: sempre 6 dígitos numéricos (gerado, não digitado na criação; digitado só para desbloquear/mutar).
- Nome da receita: 1–120 caracteres. Nome da área: até 80 caracteres. Modo de preparo: até 5000 caracteres.
- Ingredientes por receita: 1 a 100 linhas; nome do ingrediente 1–80 caracteres; quantidade numérica finita, `0 < quantidade ≤ 100000`; unidade precisa estar no enum.
- Itens de lista: array de até 500 itens por chamada de `/lista/gerar` ou nas respostas.
- Nome do ingrediente é normalizado (`trim` + `lowercase`) ao persistir, para casar com a tabela de conversão.
- Código da área validado no front com o mesmo alfabeto do gerador (`src/lib/formatoCodigo.ts`): `RCT-` seguido de 5 caracteres do alfabeto `23456789ABCDEFGHJKMNPQRSTUVWXYZ` (exclui `0/O, 1/I/L`).

**Formato de quantidade aceito**: número decimal positivo. No formulário, o usuário pode digitar vírgula ou ponto como separador decimal (`1,5` ou `1.5`) — `src/lib/numero.ts` normaliza antes de validar/enviar. Sem suporte a frações (`1/2`) nem texto livre ("a gosto").

**Textos principais** (pt-BR, tom direto, pensado para uso no mercado/celular):
- Home: "Receitas — Receitas e lista de compras da família, sem login."
- Pós-criação de área: "Área criada! Anote o código e o PIN — não tem como recuperar depois."
- Aviso de modo leitura: "Modo leitura" + botão "Desbloquear edição".
- Confirmação de exclusão de receita: `Excluir a receita "{nome}"? Essa ação não pode ser desfeita.` (via `window.confirm` nativo)
- Confirmação de limpar comprados: `Excluir N itens comprados? Essa ação não pode ser desfeita.`
- Texto de compartilhamento da lista: `🛒 Lista de compras\n- Item (quantidade+unidade)...`

**Identidade visual:**
- Cor primária: **verde-erva** (Tailwind custom `primary`, tom principal `#56762b`).
- Cor de destaque (CTAs secundários, ex. "Gerar lista", "Adicionar à lista"): **terracota** (`accent`, tom principal `#d95f22`).
- Fonte: `Nunito` declarada em `tailwind.config.js` como `font-sans` — **não está embarcada** (sem `@font-face`/link do Google Fonts); hoje o navegador cai no fallback `system-ui`. Ver dívida técnica (seção 8).
- Corpo em 16px (`text-base`), áreas de toque dos itens de lista e botões com `min-h-[44px]`.
- **Ícone do hub**: no canto superior esquerdo da Home e do header da área, aparece o símbolo "Layer" do hub decker.app.br (dois retângulos azuis `#185FA5`/`#378ADD` deslocados, ver `src/components/HubIcon.tsx`), linkando para `https://decker.app.br`. Esse ícone (e só ele) segue a identidade visual do site institucional do hub — o resto da identidade deste app (verde-erva/terracota) é própria, por design (cada app do hub tem a sua). O favicon da aba do navegador continua sendo o ícone próprio deste app (verde, letra "R"), não o do hub.

**Cookie banner e analytics:** este app usa o mesmo script vanilla compartilhado pelos demais apps do hub, vendorizado em `src/lib/decker-cookie-consent.js` e carregado via import de efeito colateral em `main.tsx` (por isso `tsconfig.app.json` tem `allowJs: true` — necessário para o TypeScript resolver esse `.js` puro). Esse script:
- Cobre **só** o consentimento de analytics (Google Consent Mode v2: `analytics_storage`, `ad_storage`, `ad_user_data`, `ad_personalization`), com banner próprio de Aceitar/Recusar e chave `decker_cookie_consent` no `localStorage`.
- Carrega GA4 só se o usuário aceitar, usando um Measurement ID **fixo e compartilhado por todo o hub** (`G-9JZ3V1YQ20`), hardcoded no próprio arquivo — não há env var por app para isso.
- Não tem nenhuma relação com a lista "Minhas áreas" (que não pede consentimento, por ser tratada como essencial).

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
- `unidadeBase`: campo adicionado além da spec original — `"g"` ou `"ml"`, define para qual unidade o ingrediente converte por padrão (farinhas/açúcares/grãos → g; líquidos → ml).
- `densidade`: g/ml, usada para converter `ml`/`l` ⇄ `g`/`kg`.
- `equivalencias`: gramas por medida de volume caseira (curadas, não derivadas por fórmula de `densidade × volume` — refletem compactação/aeração reais).
- `fonte`: uma de `IBGE`, `TACO`, `Pinheiro`, `USDA`, `Nestle-Receiteria`, na ordem de prioridade definida na spec.

**Categorias cobertas** (73 itens): farinhas e amidos (10), açúcares e adoçantes (6), grãos/cereais (7), laticínios e derivados (11), gorduras/óleos (5), líquidos diversos (5), itens de confeitaria/fermentação (5), sal (2), oleaginosas/sementes (8), molhos/condimentos (4), temperos secos (6), diversos (4).

**Nota de proveniência**: tentativas de acessar ao vivo as páginas de referência (IBGE/POF, Nestlé, Deliway, Cozinhei, MenuControl) retornaram HTTP 403 (bloqueio anti-bot) durante o desenvolvimento — os valores foram curados a partir de conhecimento consolidado de tabelas de equivalência caseira brasileiras amplamente publicadas e consistentes entre si (os três exemplos citados literalmente na spec da Fase 1 — farinha de trigo 120g/xícara, açúcar refinado 200g/xícara, leite condensado 300g/xícara — foram usados como âncora de calibração). **Não houve verificação linha a linha contra o PDF oficial do IBGE**; isso é uma dívida técnica explícita (seção 8).

## 6. Interface pública do módulo de conversão

Módulo em `src/lib/conversion/` — **zero dependências de framework** (não importa React nem nada do resto do app), pensado para ser extraído como pacote/app standalone na Fase 2.

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
// conversível (unidade, pitada) — nesse caso o chamador deve manter a
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

1. **Backend rodando em `us-east-1`, não em `sa-east-1` (São Paulo) — bug/lacuna do lado da AWS, não deste projeto.** O deploy em `sa-east-1` falhava consistentemente com `BootstrapDetectionError`: a role interna que a AWS usa para orquestrar o build do backend do Amplify Gen 2 (`AemiliaControlPlaneLambda-CodeBuildRole`, dentro de uma conta da própria AWS — confirmado comparando o ID de conta do ARN do erro com o ID de conta real do usuário no console, são contas diferentes) não tinha permissão `ssm:GetParameter` no parâmetro de bootstrap do CDK naquela região. Sem acesso a essa conta, não havia IAM a ajustar do lado do cliente. Recriar o app do zero em `us-east-1`, sem nenhuma mudança de código, resolveu de primeira — indicando uma lacuna regional da infraestrutura interna do Amplify Gen 2 em `sa-east-1`. Se a Fase 2 precisar migrar para São Paulo (ex. residência de dados), esperar o mesmo erro e considerar abrir caso no AWS Support antes de investir tempo em auto-diagnóstico.
2. **`npm ci` falha no build do Amplify Hosting; o projeto usa `npm install`.** A árvore de dependências transitivas do `@aws-amplify/backend` (cópias aninhadas de `@opentelemetry/core` em versões diferentes) faz o checador estrito de sincronia do `npm ci` falhar com `Missing: @opentelemetry/core@2.0.0 from lock file` — reproduzido localmente mesmo com o lockfile recém-gerado do zero, ou seja, é uma peculiaridade do npm com essa árvore específica, não um lockfile desatualizado. `amplify.yml` usa `npm install` nas duas fases (backend e frontend), e há um `.npmrc` com `legacy-peer-deps=true` para evitar avisos de `ERESOLVE` no meio do caminho.
3. **PIN gerado pelo servidor, não escolhido pelo usuário.** A spec original previa o usuário definindo o próprio PIN na criação da área. Na versão final, `POST /area` não aceita `pin` no body — o servidor gera 6 dígitos aleatórios e devolve em texto puro uma única vez. Decisão de produto tomada durante o desenvolvimento (PIN gerado é mais forte que PIN escolhido pelo usuário, que tende a repetir datas/sequências óbvias).
4. **Contradição na spec original sobre persistência do PIN, resolvida com um modelo mais amplo do que qualquer uma das duas opções descritas.** A spec continha duas instruções conflitantes: "front pode manter PIN em memória de sessão, nunca persistir em claro" vs. "código e PIN salvos em localStorage em claro, reabrir cai direto na área". A versão final não escolheu uma ou outra — implementou uma lista de múltiplas áreas conhecidas no aparelho (seção 4), persistida em claro no `localStorage`, tratada como funcionalidade essencial sem pedir consentimento. Resolve o requisito de "reabrir cai direto" (na verdade, "reabrir mostra a lista de áreas já conhecidas, sem redigitar código nem PIN") de forma mais rica que uma sessão única, replicando o padrão já validado por outro app do mesmo hub.
5. **`unidadeBase` adicionado a cada entrada da tabela de conversão.** A spec não previa esse campo explicitamente; foi necessário decidir, por ingrediente, se o resultado consolidado deve ser em `g` ou `ml` (ex.: farinha → g, leite → ml). Sem esse campo não daria para escolher a unidade final de forma determinística.
6. **`/area/{codigo}/lista/gerar` recebe o array de itens já mesclado, não `receitaIds`.** A spec diz "conversão roda client-side; Lambda persiste resultado já calculado" — isso foi levado ao extremo: toda a lógica de agrupamento/conversão/merge-com-lista-existente roda no cliente (`gerarLista.ts`), e a Lambda só valida PIN e regrava o array. Simplifica a Lambda (sem precisar embarcar a tabela de conversão no backend), mas o endpoint não é idempotente por `receitaIds` — cada chamada carrega o estado final desejado, já calculado.
7. **Regra de merge de itens não-conversíveis, interpretada literalmente e possivelmente contra-intuitiva.** A spec diz: item ativo existente + unidade conversível → soma; comprado OU unidade não-conversível → linha nova. Isso foi implementado ao pé da letra: ingredientes em `unidade`/`pitada` (ex. "2 ovos") **nunca** se fundem com uma linha já existente na lista, nem entre gerações sucessivas — cada "Gerar lista" repetida cria uma linha nova de "Ovos", mesmo que já exista uma ativa. Verificado em teste manual. Dentro do mesmo lote de geração (mesma chamada, múltiplas receitas selecionadas), ingredientes não-conversíveis de nome+unidade idênticos SÃO somados entre si — decisão de UX tomada durante o desenvolvimento, não estava escrita na spec.
8. **`HashRouter` em vez de rotas "limpas" (`BrowserRouter`).** Deploy em Amplify Hosting normalmente exige uma regra de rewrite (SPA fallback pra `/index.html`) configurada no console — não é possível fazer isso via código neste repositório. `HashRouter` (`/#/area/...`) evita depender dessa configuração manual, ao custo de URLs menos "limpas".
9. **PIN hasheado com `bcryptjs` (puro JS), não `bcrypt` nativo.** A spec pedia "bcrypt/argon2"; a variante pura-JS evita problemas de bundling de módulo nativo no empacotamento da Lambda pelo `ampx`/esbuild. Mesmo algoritmo, custo de CPU um pouco maior — irrelevante no volume de uso esperado.
10. **Exclusão de receita não faz cascade nos itens da lista.** Um item de lista com `origemReceitaId` apontando para uma receita já excluída fica "órfão". A spec não define esse comportamento; a decisão foi não fazer cascade, porque o item da lista já é um snapshot independente (mesma lógica de snapshot de conversão da própria spec) — apagar a receita não deveria apagar retroativamente o que já foi para a lista de compras.
11. **Cookie banner e analytics implementados com o script compartilhado do hub, não uma solução isolada para este app.** A spec não menciona cookie banner nem analytics — foram pedidos à parte durante o desenvolvimento. Em vez de uma implementação própria, o app usa o mesmo script vanilla usado pelos outros apps do hub (`decker-cookie-consent.js`, vendorizado em `src/lib/`), com GA4 usando um Measurement ID único e compartilhado por todo o hub.
12. **Ícone do hub (decker.app.br) no header, apontando para a home do hub.** Também não estava na spec original — pedido à parte, para manter a navegação consistente entre os apps do hub (mesmo padrão já usado no álbum de figurinhas). Usa só o símbolo "Layer" descrito no guia de identidade visual do site institucional do hub; o resto da paleta/tom daquele guia (fundo escuro, azul, tom B2B) é do site institucional e não foi aplicado a este app — o app de receitas mantém identidade própria (verde-erva/terracota).

## 8. Pendências e dívidas técnicas

1. **Tabela de conversão não verificada linha a linha contra fontes primárias.** Ver seção 5 — vale conferir pelo menos os itens mais usados (arroz, feijão, farinha, açúcar, óleo, manteiga) contra o PDF do IBGE/POF 2008-2009 ou o livro do Pinheiro et al. antes de confiar cegamente na tabela para uso em escala.
2. **Fonte tipográfica "Nunito" declarada mas não embarcada.** `tailwind.config.js` referencia `Nunito` em `font-sans`, mas nenhum `@font-face`/link do Google Fonts foi adicionado — hoje o navegador cai no fallback `system-ui`. Ou embarcar a fonte (self-host, evitando dependência de CDN externo) ou trocar a declaração para uma fonte de sistema explícita.
3. **Sem testes automatizados.** Toda verificação foi manual: `tsc -b`, `vite build`, bundle da Lambda via `esbuild`, e scripts ad-hoc em Node para conferir o módulo de conversão, a agregação de lista (`gerarLista.ts`) e a lista de áreas conhecidas — sem suite de testes unitários para nenhum desses módulos nem para os handlers da Lambda.
4. **Rate limit de PIN é por área, não por IP/dispositivo.** Um atacante que descubra o código da área (formato curto, 5 caracteres) ainda tem só 5 tentativas antes do bloqueio de 15 min, mas nada impede tentativas distribuídas de descobrir códigos de área válidos por força bruta (sem rate limit na criação de área nem no GET de leitura). Aceitável para o caso de uso (app doméstico, sem dados sensíveis), mas vale registrar.
5. **PIN salvo como "Editor" no aparelho não é reverificado a cada visita** — só na primeira vez que foi desbloqueado (ou implicitamente, na próxima mutação real, que falharia com 401 se o PIN estivesse errado). Mesmo modelo de confiança de outro app do hub que segue o mesmo padrão.
6. **`gerarLista.ts` roda os cálculos de conversão inteiramente no cliente** e manda o array final pronto para a Lambda persistir. Funciona bem para um dispositivo escrevendo por vez, mas dois dispositivos gerando lista "ao mesmo tempo" a partir do mesmo estado desatualizado vão se sobrescrever (last-write-wins, escopo aceito pela spec) — a janela entre ler o estado e escrever o resultado calculado é um pouco maior do que seria com lógica 100% no servidor.
7. **App e domínio do Amplify Hosting foram criados manualmente no console AWS** — não há como provisionar isso via código/CDK neste repositório (isso é orquestração de nível "conta AWS", fora do escopo de `amplify/backend.ts`, que só provisiona os recursos DENTRO do app já criado). Se precisar recriar: criar app no Amplify Hosting apontando pro repo/branch `main`, preferencialmente em `us-east-1` (ver item 1), e configurar o domínio customizado `receita.decker.app.br`. Nenhuma env var de build é necessária além do que o próprio `amplify.yml` já gera automaticamente (a `apiUrl` sai do `amplify_outputs.json` do próprio deploy; o GA4 usa ID fixo no código-fonte, não env var).
8. **GA4 usa uma propriedade compartilhada por todo o hub** (mesmo Measurement ID em todos os apps) — os eventos deste app aparecem misturados com os de outros subdomínios na mesma propriedade GA4 (diferenciáveis pelo hostname do evento). Se a Fase 2 quiser métricas isoladas por app, seria necessário trocar esse ID fixo por um específico deste app em `src/lib/decker-cookie-consent.js`, o que quebra a consistência "um script, todos os apps" — decisão a ser tomada conscientemente, não só tecnicamente.
9. **Domínio e ícone da aba do navegador (favicon) são próprios deste app** (verde, letra "R") — distinto do ícone do hub que aparece dentro da página (ver seção 4). Isso é intencional, mas vale confirmar que é o comportamento desejado antes de replicar o padrão em outros apps futuros do hub.
