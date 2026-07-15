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

export interface Receita {
  receitaId: string;
  areaCodigo: string;
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

export interface Lista {
  listaId: string;
  areaCodigo: string;
  nome: string;
  itens: ItemLista[];
}

export interface AreaMeta {
  codigo: string;
  nome: string | null;
  criadaEm: string;
}

export interface AreaCompleta {
  meta: AreaMeta;
  receitas: Receita[];
  lista: Lista;
}

export interface ApiErrorBody {
  erro: string;
  mensagem: string;
}
