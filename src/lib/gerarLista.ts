import { converterParaBase, normalizarNomeIngrediente } from './conversion';
import type { ItemLista, Receita, Unidade } from '../types';

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/**
 * Gera o novo array de itens da lista a partir das receitas selecionadas,
 * mesclando com os itens já existentes conforme a regra de duplicado:
 * - Ingrediente convertível (tabela + unidade em g/kg/ml/l/xicara/colher_*):
 *   agregado com outros ingredientes convertíveis do mesmo lote e, se já
 *   existir um item ATIVO de mesmo nome normalizado + mesma unidade base,
 *   soma na linha existente.
 * - Ingrediente não convertível (fora da tabela, ou unidade "unidade"/"pitada"):
 *   itens do mesmo lote com nome+unidade idênticos são somados entre si,
 *   mas NUNCA mesclados com itens já existentes na lista (ativos ou
 *   comprados) — sempre viram uma linha nova.
 * A conversão roda aqui (client-side); o resultado já calculado é o que a
 * Lambda persiste.
 */
export function gerarItensLista(receitasSelecionadas: Receita[], itensAtuais: ItemLista[]): ItemLista[] {
  const convertiveis = new Map<
    string,
    { valor: number; unidade: 'g' | 'ml'; nomeExibicao: string; origemReceitaId: string }
  >();
  const naoConvertiveis = new Map<
    string,
    { quantidade: number; unidade: Unidade; nomeExibicao: string; origemReceitaId: string }
  >();

  for (const receita of receitasSelecionadas) {
    for (const ing of receita.ingredientes) {
      const nomeNorm = normalizarNomeIngrediente(ing.nome);
      const resultado = converterParaBase(nomeNorm, ing.quantidade, ing.unidade);

      if (resultado) {
        const chave = `${nomeNorm}::${resultado.unidade}`;
        const atual = convertiveis.get(chave);
        if (atual) {
          atual.valor += resultado.valor;
        } else {
          convertiveis.set(chave, {
            valor: resultado.valor,
            unidade: resultado.unidade,
            nomeExibicao: ing.nome.trim(),
            origemReceitaId: receita.receitaId,
          });
        }
      } else {
        const chave = `${nomeNorm}::${ing.unidade}`;
        const atual = naoConvertiveis.get(chave);
        if (atual) {
          atual.quantidade += ing.quantidade;
        } else {
          naoConvertiveis.set(chave, {
            quantidade: ing.quantidade,
            unidade: ing.unidade,
            nomeExibicao: ing.nome.trim(),
            origemReceitaId: receita.receitaId,
          });
        }
      }
    }
  }

  const novosItens = itensAtuais.map((item) => ({ ...item }));

  for (const [chave, grupo] of convertiveis) {
    const [nomeNorm, unidade] = chave.split('::');
    const existente = novosItens.find(
      (item) =>
        item.status === 'ativo' &&
        normalizarNomeIngrediente(item.nome) === nomeNorm &&
        item.unidade === unidade,
    );
    if (existente) {
      existente.quantidade = arredondar(existente.quantidade + grupo.valor);
    } else {
      novosItens.push({
        itemId: crypto.randomUUID(),
        nome: grupo.nomeExibicao,
        quantidade: arredondar(grupo.valor),
        unidade: unidade as Unidade,
        status: 'ativo',
        compradoEm: null,
        origemReceitaId: grupo.origemReceitaId,
      });
    }
  }

  for (const grupo of naoConvertiveis.values()) {
    novosItens.push({
      itemId: crypto.randomUUID(),
      nome: grupo.nomeExibicao,
      quantidade: arredondar(grupo.quantidade),
      unidade: grupo.unidade,
      status: 'ativo',
      compradoEm: null,
      origemReceitaId: grupo.origemReceitaId,
    });
  }

  return novosItens;
}
