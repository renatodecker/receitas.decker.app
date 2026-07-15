/**
 * Módulo de conversão de medidas caseiras <-> gramas/mililitros.
 * Isolado e sem dependências de framework para permitir reuso como
 * pacote/app standalone em fase futura.
 */

export const UNIDADES_CONVERSIVEIS = [
  'g',
  'kg',
  'ml',
  'l',
  'xicara',
  'colher_sopa',
  'colher_cha',
] as const;

export const UNIDADES_NAO_CONVERSIVEIS = ['unidade', 'pitada'] as const;

export type UnidadeConversivel = (typeof UNIDADES_CONVERSIVEIS)[number];
export type UnidadeNaoConversivel = (typeof UNIDADES_NAO_CONVERSIVEIS)[number];
export type UnidadeQualquer = UnidadeConversivel | UnidadeNaoConversivel;

export type UnidadeBase = 'g' | 'ml';

export interface EquivalenciasMedidas {
  /** gramas por xícara (240 ml) */
  xicara: number;
  /** gramas por colher de sopa (15 ml) */
  colher_sopa: number;
  /** gramas por colher de chá (5 ml) */
  colher_cha: number;
}

export interface IngredienteConversao {
  /** nome normalizado: lowercase, sem acento, trim */
  ingrediente: string;
  /** unidade em que a conversão retorna o valor consolidado */
  unidadeBase: UnidadeBase;
  /** densidade em g/ml, usada para converter ml/l <-> g/kg */
  densidade: number;
  /** gramas por medida de volume caseira, tabela curada (não derivada por fórmula) */
  equivalencias: EquivalenciasMedidas;
  /** fonte dos dados, por ordem de prioridade: IBGE, TACO, Pinheiro, USDA, Nestle-Receiteria */
  fonte: string;
}

export interface ResultadoConversao {
  valor: number;
  unidade: UnidadeBase;
  ingrediente: IngredienteConversao;
}
