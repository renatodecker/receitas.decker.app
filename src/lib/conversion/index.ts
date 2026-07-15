import dadosIngredientes from './data.json';
import { normalizarNomeIngrediente } from './normalizar';
import type { IngredienteConversao, ResultadoConversao, UnidadeQualquer } from './types';

export { normalizarNomeIngrediente } from './normalizar';
export * from './types';

const TABELA: readonly IngredienteConversao[] = dadosIngredientes as IngredienteConversao[];

const INDICE: ReadonlyMap<string, IngredienteConversao> = new Map(
  TABELA.map((item) => [item.ingrediente, item]),
);

/** Retorna a entrada curada da tabela para um nome de ingrediente (já normalizado ou não). */
export function buscarConversao(nomeIngrediente: string): IngredienteConversao | undefined {
  return INDICE.get(normalizarNomeIngrediente(nomeIngrediente));
}

/** Lista todos os nomes de ingredientes normalizados suportados pela tabela. */
export function listarIngredientesSuportados(): string[] {
  return TABELA.map((item) => item.ingrediente);
}

/**
 * Converte quantidade+unidade para a unidade base do ingrediente (g ou ml).
 * Retorna null quando o ingrediente não está na tabela ou a unidade não é
 * conversível (unidade, pitada) — nesse caso o chamador deve manter a
 * linha original em vez de arriscar uma conversão incorreta.
 */
export function converterParaBase(
  nomeIngrediente: string,
  quantidade: number,
  unidade: UnidadeQualquer,
): ResultadoConversao | null {
  const ingrediente = buscarConversao(nomeIngrediente);
  if (!ingrediente) return null;

  const { densidade, equivalencias, unidadeBase } = ingrediente;
  let emGramas: number;

  switch (unidade) {
    case 'g':
      emGramas = quantidade;
      break;
    case 'kg':
      emGramas = quantidade * 1000;
      break;
    case 'ml':
      emGramas = quantidade * densidade;
      break;
    case 'l':
      emGramas = quantidade * 1000 * densidade;
      break;
    case 'xicara':
      emGramas = quantidade * equivalencias.xicara;
      break;
    case 'colher_sopa':
      emGramas = quantidade * equivalencias.colher_sopa;
      break;
    case 'colher_cha':
      emGramas = quantidade * equivalencias.colher_cha;
      break;
    case 'unidade':
    case 'pitada':
      return null;
    default:
      return null;
  }

  const valor = unidadeBase === 'g' ? emGramas : emGramas / densidade;

  return { valor, unidade: unidadeBase, ingrediente };
}
