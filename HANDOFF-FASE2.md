# Hub de Receitas — Handoff técnico Fase 1 → Fase 2

> Documento autocontido, reescrito do zero (substitui qualquer versão anterior). Escrito para alimentar a especificação da Fase 2 em uma sessão sem acesso a este repositório, à spec original da Fase 1, nem ao histórico de conversa desta sessão.

## Status: em produção

App no ar em **https://receita.decker.app.br**, backend rodando em **`us-east-1`** (não `sa-east-1` — ver seção 7, item 1, motivo importante). Repositório GitHub `renatodecker/receitas.decker.app`, tudo na branch `main`.

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
`pinFailCount`/`pinLockedUntil` não estavam no modelo da spec original da Fase 1 — foram adicionados para o rate limit de 5 erros → 15 min de bloqueio.

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
  nome: string,              // sempre "Lista de compras" nesta fase
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

`Unidade` = `"g" | "kg" | "ml" | "l" | "xicara" | "colher_sopa" | "colher_cha" | "unidade" | "pitada"`.

**Mutação de itens da lista é sempre "read full array, write full array"**: toda operação que muda `itens` (gerar, mudar status, limpar) lê o item LISTA inteiro e regrava o array `itens` completo com `SET itens = :itens`. Sem update por índice/elemento — aceitável porque não há concorrência simultânea tratada nesta fase (last-write-wins).

## 2. Contrato de rotas final da Lambda

Uma Lambda (Node.js 22, `amplify/functions/api/handler.ts`) exposta via **Function URL** (`authType: NONE`, CORS nativo liberando `content-type` e `x-area-pin`). Roteamento manual por `method` + `rawPath` em `amplify/functions/api/router.ts`.

Formato de erro padrão (todo 4xx/5xx):
```json
{ "erro": "codigo_maquina", "mensagem": "Texto em pt-BR para exibir ao usuário" }
```

| Rota | Método | Auth | Body | Resposta 2xx |
|---|---|---|---|---|
| `/area` | POST | — | `{ nome?: string }` | `201 { codigo: string, pin: string }` — **PIN gerado pelo servidor**, devolvido em texto puro só nesta resposta |
| `/area/{codigo}` | GET | — | — | `200 { meta: {codigo,nome,criadaEm}, receitas: Receita[], lista: Lista }` |
| `/area/{codigo}/verificar-pin` | POST | PIN | — | `200 { ok: true }` — **rota nova**, valida o PIN sem disparar nenhuma mutação |
| `/area/{codigo}/receita` | POST | PIN | `{ nome, modoPreparo, ingredientes: Ingrediente[] }` | `201 Receita` |
| `/area/{codigo}/receita/{id}` | PUT | PIN | idem POST | `200 Receita` |
| `/area/{codigo}/receita/{id}` | DELETE | PIN | — | `200 { ok: true }` |
| `/area/{codigo}/lista/gerar` | POST | PIN | `{ itens: ItemLista[] }` (array **completo e já mesclado**, calculado no cliente) | `200 Lista` |
| `/area/{codigo}/lista/item/{id}` | PUT | PIN | `{ status: "ativo" \| "comprado" }` | `200 Lista` |
| `/area/{codigo}/lista/limpar` | POST | PIN | — | `200 { removidos: number, ...Lista }` |

PIN vai no header `X-Area-Pin` em toda rota marcada "PIN". Sem PIN / PIN incorreto: `401 pin_ausente` ou `401 pin_invalido`. Bloqueio por rate limit: `403 bloqueado`. Recurso inexistente: `404`. Validação de payload: `400` com código específico (`nome_invalido`, `ingredientes_invalidos`, `itens_invalidos`, `status_invalido`, etc). Erro não tratado: `500 erro_interno`.

**Mudança importante desde a v1 deste documento:** `POST /area` não recebe mais `pin` no body — o usuário não escolhe o próprio PIN. O servidor gera um PIN numérico de 6 dígitos (`amplify/functions/api/pin.ts:gerarPin`, `crypto.randomInt`) e devolve em texto puro **uma única vez**, na resposta da criação. Depois disso só existe o hash — não há como recuperar.

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
│       ├── pin.ts                 # gera PIN, hash, verificação + rate limit
│       ├── codigoArea.ts          # gerador do código RCT-XXXXX
│       ├── validacao.ts           # validação de payloads + classe ErroValidacao
│       ├── types.ts               # tipos dos itens DynamoDB (duplicados de src/types.ts
│       │                          #   de propósito — cada função Amplify é autocontida)
│       └── handlers/
│           ├── area.ts            # criarArea, obterArea, verificarPinArea
│           ├── receita.ts         # criar/editar/excluirReceita
│           └── lista.ts           # gerar/mudarStatus/limparComprados
├── src/
│   ├── main.tsx                   # bootstrap + import de efeito colateral do cookie banner
│   ├── App.tsx                    # rotas (react-router-dom, HashRouter)
│   ├── types.ts                   # tipos de domínio compartilhados no front
│   ├── vite-env.d.ts
│   ├── api/client.ts               # cliente fetch (uma função por rota da Lambda)
│   ├── components/
│   │   └── HubIcon.tsx            # ícone "Layer" do hub, link para decker.app.br
│   ├── context/AreaContext.tsx    # carrega GET /area/:codigo; expõe pin, somenteLeitura,
│   │                              #   desbloquear() e setters otimistas de receitas/lista
│   ├── lib/
│   │   ├── conversion/            # módulo de conversão — ver seções 5 e 6 (inalterado)
│   │   ├── gerarLista.ts          # agregação de ingredientes de receitas -> itens de lista
│   │   ├── areasConhecidas.ts     # lista de áreas conhecidas neste aparelho (ver seção 4)
│   │   ├── formatoCodigo.ts       # normalizarCodigo / isCodigoValido (formato RCT-XXXXX)
│   │   ├── decker-cookie-consent.js  # script vanilla vendorizado do hub (ver seção 4)
│   │   ├── whatsapp.ts            # monta links wa.me
│   │   ├── unidades.ts            # labels de unidade + formatação de quantidade
│   │   └── numero.ts              # parse de quantidade digitada (vírgula ou ponto)
│   └── pages/
│       ├── Home.tsx               # "Minhas áreas" + acessar por código + criar
│       ├── AreaLayout.tsx         # header (ícone hub, compartilhar, desbloquear) + tabs
│       ├── ReceitasLista.tsx      # tab "Receitas" (index route da área)
│       ├── ReceitaForm.tsx        # criar E editar receita (bloqueado em modo leitura)
│       ├── ReceitaDetalhe.tsx
│       ├── GerarLista.tsx         # seleção de receitas -> gera itens (bloqueado em modo leitura)
│       └── ListaCompras.tsx       # tab "Lista de compras" (timer/desfazer de 5s)
├── public/
│   ├── favicon.svg                # ícone próprio do app (não é o do hub)
│   ├── og-image.png               # preview social gerado (1200x630)
│   ├── robots.txt
│   └── sitemap.xml
├── package.json                   # front + backend-as-code no MESMO package.json
├── .npmrc                          # legacy-peer-deps=true (ver seção 7, item 2)
├── vite.config.ts, tailwind.config.js, postcss.config.js
├── tsconfig.json / tsconfig.app.json (allowJs:true, p/ o .js vendorizado) / tsconfig.node.json
└── README.md
```

Não existem mais os arquivos `src/lib/storage.ts`, `src/lib/consent.ts`, `src/lib/analytics.ts` e `src/components/ConsentBanner.tsx` que uma versão intermediária deste app chegou a ter — foram removidos e substituídos pelo que está descrito na seção 4.

## 4. Decisões tomadas em pontos delegados pela spec da Fase 1

**Modelo de acesso leitura/escrita, implementado de verdade nesta rodada:**
- Acessar por código abre a área em **modo leitura**, sem pedir PIN.
- Dentro da área, um aviso "Modo leitura" com botão **"Desbloquear edição"** pede o PIN só na hora de mexer em algo. Chama `POST /area/{codigo}/verificar-pin` — se válido, o PIN passa a ficar disponível no `AreaContext` (`somenteLeitura` vira `false`) para o resto da visita.
- Todas as ações de escrita (nova receita, editar, excluir, marcar item comprado, gerar lista, limpar comprados) ficam **ocultas** em modo leitura; as rotas de formulário (`ReceitaForm`, `GerarLista`) redirecionam de volta pra área se acessadas diretamente sem PIN.

**"Minhas áreas" — persistência local, sem gate de consentimento:**
Adotado o mesmo padrão já usado no álbum de figurinhas do hub (`decker.app.br/album`): uma lista de até 20 áreas conhecidas neste aparelho (`src/lib/areasConhecidas.ts`, chave `receitas-decker:areas` no `localStorage`), cada entrada com `{ codigo, pin: string|null, nome: string|null }`. `pin: null` = área conhecida só em modo leitura (nunca desbloqueada neste aparelho). A Home mostra essa lista com badge **Leitor**/**Editor**, botão **Abrir** e um **×** para esquecer a área (não afeta a área em si, só a lista local). Isso é tratado como **funcionalidade essencial**, sem pedir permissão — mesmo precedente do álbum, que já grava sem gate.

**Mapa de telas/navegação** — `HashRouter` (URLs `#/area/RCT-XXXXX/...`; motivo na seção 7). Rotas:
- `/` → Home: lista "Minhas áreas" + form "Acessar área" (só código) + "Criar nova área"
- `/area/:codigo` → layout com header (ícone do hub, nome/código da área, compartilhar, "Minhas áreas") + aviso de modo leitura quando aplicável + 2 tabs
  - índice → lista de receitas
  - `/receitas/nova`, `/receitas/:id`, `/receitas/:id/editar`
  - `/lista` → lista de compras
  - `/lista/gerar` → seleção de receitas para gerar itens

**PIN — geração e formato:** sempre 6 dígitos numéricos, **gerado pelo servidor** na criação da área (`crypto.randomInt`), nunca escolhido pelo usuário. Mostrado em texto puro uma única vez, na tela de confirmação pós-criação (com botão "Copiar"). Sem recuperação — perdido o PIN (e não estando salvo como "Editor" neste aparelho), a área vira permanentemente só-leitura para quem não o souber.

**Compartilhamento com PIN opcional:** o botão "Compartilhar" no header da área abre um pequeno painel com checkbox "Incluir PIN no link" (desabilitado se a área ainda estiver em modo leitura) antes de montar o link `wa.me`.

**Validações e limites** (aplicados na Lambda, em `validacao.ts`):
- Nome da receita: 1–120 caracteres. Nome da área: até 80. Modo de preparo: até 5000 caracteres.
- Ingredientes por receita: 1 a 100 linhas; nome 1–80 caracteres; quantidade numérica finita, `0 < quantidade ≤ 100000`; unidade no enum.
- Itens de lista: array de até 500 itens.
- Nome do ingrediente é normalizado (`trim` + `lowercase`) ao persistir.
- Código da área validado no front com o mesmo alfabeto do gerador (`src/lib/formatoCodigo.ts`): exclui `0/O, 1/I/L`.

**Formato de quantidade aceito**: número decimal positivo; aceita vírgula ou ponto como separador decimal no formulário (`src/lib/numero.ts`). Sem frações nem texto livre.

**Textos principais** (pt-BR):
- Home: "Receitas — Receitas e lista de compras da família, sem login."
- Pós-criação: "Área criada! Anote o código e o PIN — não tem como recuperar depois."
- Confirmação de exclusão de receita: `Excluir a receita "{nome}"? Essa ação não pode ser desfeita.`
- Confirmação de limpar comprados: `Excluir N itens comprados? Essa ação não pode ser desfeita.`
- Compartilhamento da lista: `🛒 Lista de compras\n- Item (quantidade+unidade)...`

**Identidade visual:**
- Cor primária: verde-erva (`primary`, Tailwind custom, tom principal `#56762b`). Cor de destaque: terracota (`accent`, tom principal `#d95f22`). Fonte declarada: `Nunito` (não embarcada — ver dívida técnica). Áreas de toque ≥44px.
- **Ícone do hub**: adicionado nesta rodada, a pedido explícito, conforme `identidade-visual-decker.md` (arquivo de identidade do site institucional decker.app.br, não deste app). É o símbolo "Layer" (dois retângulos azuis `#185FA5`/`#378ADD` deslocados), renderizado em `src/components/HubIcon.tsx`, linkando para `https://decker.app.br`. Aparece na Home e no header da área. **Importante para a Fase 2:** só esse ícone+link foi adotado — o resto de `identidade-visual-decker.md` (fundo `#0A0F1E`, paleta azul, tom B2B) é a identidade do **site institucional** da empresa, não deste app de consumo; o app de receitas mantém sua própria identidade verde-erva/terracota, por design (cada app do hub tem a sua).

**Cookie banner e analytics — decisão revista nesta rodada:** o banner de consentimento próprio (React, com toggle "lembrar área") foi **removido**. Em vez disso, o app usa o mesmo script vanilla compartilhado pelos outros apps do hub, vendorizado em `src/lib/decker-cookie-consent.js` e carregado via import de efeito colateral em `main.tsx`. Esse script:
- Cobre **só** o consentimento de analytics (Google Consent Mode v2: `analytics_storage`, `ad_storage` etc.), com banner próprio (Aceitar/Recusar) e chave `decker_cookie_consent` no `localStorage`.
- Carrega GA4 com um Measurement ID **fixo e compartilhado por todo o hub** (`G-9JZ3V1YQ20`), hardcoded no próprio arquivo — não há env var por app para isso.
- Não tem nenhuma relação com a lista "Minhas áreas" (que, como descrito acima, não pede consentimento).

## 5. Estrutura do JSON de conversão

**Inalterado desde a primeira versão deste handoff.** Arquivo: `src/lib/conversion/data.json`. Array de 73 ingredientes curados.

```json
{
  "ingrediente": "farinha de trigo",
  "unidadeBase": "g",
  "densidade": 0.53,
  "equivalencias": { "xicara": 120, "colher_sopa": 7.5, "colher_cha": 2.5 },
  "fonte": "IBGE"
}
```

- `ingrediente`: chave normalizada (lowercase, sem acento).
- `unidadeBase` (`"g"` ou `"ml"`): campo adicionado além da spec original, decide para qual unidade o ingrediente converte por padrão.
- `densidade`: g/ml, para converter `ml`/`l` ⇄ `g`/`kg`.
- `equivalencias`: gramas por medida de volume caseira, curadas (não derivadas por fórmula).
- `fonte`: uma de `IBGE`, `TACO`, `Pinheiro`, `USDA`, `Nestle-Receiteria`.

**Nota de proveniência (mantida da v1):** tentativas de acessar ao vivo as páginas de referência (IBGE/POF, Nestlé, Deliway, Cozinhei, MenuControl) retornaram HTTP 403 durante a sessão original — os valores foram curados a partir de conhecimento consolidado de tabelas de equivalência caseira brasileiras amplamente publicadas, usando os três exemplos citados na spec da Fase 1 (farinha de trigo 120g/xícara, açúcar refinado 200g/xícara, leite condensado 300g/xícara) como âncora. **Segue sem verificação linha a linha contra fontes primárias** — dívida técnica (seção 8).

## 6. Interface pública do módulo de conversão

**Inalterada.** Módulo em `src/lib/conversion/` — zero dependências de framework, pensado para reuso como pacote/app standalone.

```ts
// src/lib/conversion/normalizar.ts
function normalizarNomeIngrediente(nome: string): string

// src/lib/conversion/index.ts
function buscarConversao(nomeIngrediente: string): IngredienteConversao | undefined
function listarIngredientesSuportados(): string[]
function converterParaBase(
  nomeIngrediente: string,
  quantidade: number,
  unidade: UnidadeQualquer, // 'g'|'kg'|'ml'|'l'|'xicara'|'colher_sopa'|'colher_cha'|'unidade'|'pitada'
): ResultadoConversao | null   // null = não conversível (fora da tabela, ou unidade/pitada)

interface IngredienteConversao {
  ingrediente: string;
  unidadeBase: 'g' | 'ml';
  densidade: number;
  equivalencias: { xicara: number; colher_sopa: number; colher_cha: number };
  fonte: string;
}
interface ResultadoConversao { valor: number; unidade: 'g' | 'ml'; ingrediente: IngredienteConversao }
```

A agregação entre receitas (somar ingredientes convertidos, mesclar com itens já ativos na lista) continua fora deste módulo, em `src/lib/gerarLista.ts` — regra de negócio do app de receitas, não do conversor genérico.

## 7. Desvios desta spec e motivo

1. **Backend rodando em `us-east-1`, não `sa-east-1` (São Paulo) — motivo: bug/lacuna do lado da AWS, não do código.** O deploy em `sa-east-1` falhava consistentemente com `BootstrapDetectionError`: a role interna que a AWS usa para orquestrar o build do Amplify Gen 2 (`AemiliaControlPlaneLambda-CodeBuildRole`, dentro de uma conta da própria AWS, **não a conta do usuário** — confirmado comparando o ID de conta do ARN do erro com o ID de conta real do usuário no console) não tinha permissão `ssm:GetParameter` no parâmetro de bootstrap do CDK naquela região. Sem acesso a essa conta, não havia IAM a ajustar do lado do cliente. Recriar o app do zero em `us-east-1` resolveu de primeira, sem nenhuma mudança de código — indicando uma lacuna regional da infraestrutura interna do Amplify Gen 2 em `sa-east-1`, não algo introduzido por este projeto. **Se a Fase 2 precisar migrar para São Paulo** (ex. residência de dados), esperar o mesmo erro e considerar abrir caso no AWS Support antes de investir tempo em auto-diagnóstico.
2. **`npm ci` falha no build do Amplify Hosting; usa-se `npm install`.** A árvore de dependências transitivas do `@aws-amplify/backend` (cópias aninhadas de `@opentelemetry/core` em versões diferentes) faz o checador estrito de sincronia do `npm ci` falhar com `Missing: @opentelemetry/core@2.0.0 from lock file` — reproduzido localmente mesmo com o lockfile recém-gerado do zero, ou seja, é uma peculiaridade do npm com essa árvore específica, não um lockfile desatualizado. `amplify.yml` usa `npm install` nas duas fases (backend e frontend) e há um `.npmrc` com `legacy-peer-deps=true`.
3. **PIN gerado pelo servidor, não escolhido pelo usuário** (mudança pedida explicitamente depois do primeiro deploy). `POST /area` não aceita mais `pin` no body.
4. **Contradição na spec original sobre persistência do PIN, resolvida a favor de salvar no dispositivo — e depois superada pelo padrão "Minhas áreas".** A spec da Fase 1 tinha duas instruções conflitantes sobre isso; a versão atual nem usa mais "sessão única" — usa a lista de áreas conhecidas descrita na seção 4, que persiste incondicionalmente (sem gate de consentimento), seguindo o precedente do álbum de figurinhas do hub.
5. **`/area/{codigo}/lista/gerar` recebe o array de itens já mesclado, calculado no cliente**, não `receitaIds`. Mantido desde a v1 — a Lambda só valida PIN e regrava o array, sem embarcar a tabela de conversão no backend.
6. **`unidadeBase` adicionado a cada entrada da tabela de conversão** (mantido da v1) — necessário pra decidir, por ingrediente, se o resultado consolidado é em `g` ou `ml`.
7. **Regra de merge de itens não-conversíveis, interpretada literalmente** (mantido da v1): ingredientes em `unidade`/`pitada` nunca se fundem com uma linha já existente na lista — cada "Gerar lista" repetida cria uma linha nova. Dentro do mesmo lote de geração, itens de nome+unidade idênticos são somados entre si.
8. **`HashRouter` em vez de rotas "limpas"** — evita depender de configurar regra de rewrite no Amplify Hosting via console (não é possível fazer isso via código neste repositório).
9. **PIN hasheado com `bcryptjs` (puro JS), não `bcrypt` nativo** — evita problemas de bundling de módulo nativo no empacotamento da Lambda.
10. **Exclusão de receita não faz cascade nos itens da lista** — um item com `origemReceitaId` de uma receita já excluída fica órfão, por design (o item da lista é um snapshot independente).
11. **Cookie banner e analytics trocados de uma implementação própria (React) para o script vanilla compartilhado do hub** (seção 4) — decisão tomada ao ver que o padrão real do hub (álbum de figurinhas) não gateia a persistência funcional por trás de consentimento, só a parte de analytics.
12. **Ícone do hub (`decker.app.br`) adicionado no header**, a pedido explícito, usando só o símbolo "Layer" de `identidade-visual-decker.md` — sem adotar o resto daquela identidade (que é do site institucional, não deste app).

## 8. Pendências e dívidas técnicas

1. **Tabela de conversão não verificada linha a linha contra fontes primárias** (IBGE/POF, Pinheiro et al.) — ver seção 5. Vale conferir pelo menos os itens mais usados antes de confiar cegamente nela.
2. **Fonte "Nunito" declarada no Tailwind mas nunca embarcada** — `tailwind.config.js` referencia `Nunito` em `font-sans`, sem `@font-face`/link do Google Fonts; hoje cai no fallback `system-ui`.
3. **Sem testes automatizados.** Toda verificação foi manual: `tsc -b`, `vite build`, bundle da Lambda via `esbuild`, e scripts ad-hoc em Node para conferir o conversor, a agregação de lista e a lista de áreas conhecidas.
4. **Rate limit de PIN é por área, não por IP/dispositivo.** Cada área aguenta só 5 tentativas antes do bloqueio de 15 min, mas nada impede tentativas distribuídas de descobrir códigos de área válidos por força bruta (sem rate limit na criação de área nem no GET de leitura). Aceitável para o caso de uso, vale registrar.
5. **Confiança no PIN salvo como "Editor" no aparelho não é reverificada a cada visita** — só na primeira vez que desbloqueou (ou na próxima mutação real, que falha com 401 se o PIN mudou/expirou de alguma forma — cenário raro, já que não há troca de PIN nesta fase). Mesmo modelo de confiança do álbum de figurinhas.
6. **`gerarLista.ts` roda os cálculos de conversão inteiramente no cliente** e manda o array final pronto pra Lambda persistir — dois dispositivos gerando lista "ao mesmo tempo" a partir do mesmo estado desatualizado vão se sobrescrever (last-write-wins, aceito pela spec, mas a janela de inconsistência é um pouco maior do que seria com lógica 100% no servidor).
7. **Domínio e app do Amplify Hosting foram criados manualmente no console** (não há como provisionar isso via código/CDK neste repositório) — se o app do Amplify Hosting precisar ser recriado no futuro (ex. mover de conta), os passos manuais são: criar app apontando pro repo/branch `main` em `us-east-1`, configurar o domínio customizado `receita.decker.app.br`, e garantir que a env var de build tem acesso de escrita normal (nenhuma env var extra é necessária hoje — o GA4 usa ID fixo no código, não env var).
8. **GA4 usa uma propriedade compartilhada por todo o hub** (`G-9JZ3V1YQ20`) — os eventos deste app aparecem misturados com os de outros subdomínios na mesma propriedade GA4 (diferenciáveis pelo hostname). Se a Fase 2 quiser métricas isoladas por app, seria necessário trocar esse ID fixo por um específico deste app (mudança pequena em `src/lib/decker-cookie-consent.js`, mas quebra a consistência "um script, todos os apps").
