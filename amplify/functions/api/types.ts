export type Unidade =
  | 'g'
  | 'kg'
  | 'ml'
  | 'l'
  | 'xicara'
  | 'colher_sopa'
  | 'colher_cha'
  | 'unidade'
  | 'pitada';

export interface Ingrediente {
  nome: string;
  quantidade: number;
  unidade: Unidade;
}

export interface ReceitaItem {
  areaCodigo: string;
  sk: `RECEITA#${string}`;
  receitaId: string;
  nome: string;
  modoPreparo: string;
  tags: string[];
  ingredientes: Ingrediente[];
  criadaEm: string;
}

export type StatusItem = 'ativo' | 'comprado';

export interface ItemLista {
  itemId: string;
  nome: string;
  quantidade: number;
  unidade: Unidade;
  status: StatusItem;
  compradoEm: string | null;
  origemReceitaId: string | null;
}

export interface ListaItem {
  areaCodigo: string;
  sk: `LISTA#${string}`;
  listaId: string;
  nome: string;
  itens: ItemLista[];
}

export interface MetaItem {
  areaCodigo: string;
  sk: 'META';
  pinHash: string;
  nome: string | null;
  criadaEm: string;
  pinFailCount: number;
  pinLockedUntil: string | null;
}

export interface ErroApi {
  erro: string;
  mensagem: string;
}
