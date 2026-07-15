import { queryByPrefix, updateItem } from '../db';
import { verificarPin } from '../pin';
import type { ItemLista, ListaItem, StatusItem } from '../types';
import { ErroValidacao } from '../validacao';

interface Resposta {
  status: number;
  body: unknown;
}

const UNIDADES_VALIDAS = new Set([
  'g',
  'kg',
  'ml',
  'l',
  'xicara',
  'colher_sopa',
  'colher_cha',
  'unidade',
  'pitada',
]);

async function buscarLista(codigo: string): Promise<ListaItem | undefined> {
  const listas = await queryByPrefix<ListaItem>(codigo, 'LISTA#');
  return listas[0];
}

function validarItens(itens: unknown): asserts itens is ItemLista[] {
  if (!Array.isArray(itens) || itens.length > 500) {
    throw new ErroValidacao({ erro: 'itens_invalidos', mensagem: 'Lista de itens inválida (máx. 500 itens).' });
  }
  for (const item of itens) {
    const it = item as ItemLista;
    if (
      typeof it !== 'object' ||
      it === null ||
      typeof it.itemId !== 'string' ||
      typeof it.nome !== 'string' ||
      typeof it.quantidade !== 'number' ||
      !Number.isFinite(it.quantidade) ||
      it.quantidade <= 0 ||
      !UNIDADES_VALIDAS.has(it.unidade) ||
      (it.status !== 'ativo' && it.status !== 'comprado') ||
      (it.compradoEm !== null && typeof it.compradoEm !== 'string') ||
      (it.origemReceitaId !== null && typeof it.origemReceitaId !== 'string')
    ) {
      throw new ErroValidacao({ erro: 'itens_invalidos', mensagem: 'Um ou mais itens da lista têm formato inválido.' });
    }
  }
}

export async function gerarItensLista(codigo: string, body: unknown, pin: string | undefined): Promise<Resposta> {
  const resultadoPin = await verificarPin(codigo, pin);
  if (!resultadoPin.ok) return { status: resultadoPin.status!, body: resultadoPin.body };

  const lista = await buscarLista(codigo);
  if (!lista) {
    return { status: 404, body: { erro: 'lista_nao_encontrada', mensagem: 'Lista não encontrada.' } };
  }

  const { itens } = (body ?? {}) as Record<string, unknown>;
  validarItens(itens);

  await updateItem(codigo, lista.sk, 'SET itens = :itens', { ':itens': itens });
  return { status: 200, body: { listaId: lista.listaId, nome: lista.nome, itens } };
}

export async function mudarStatusItem(
  codigo: string,
  itemId: string,
  body: unknown,
  pin: string | undefined,
): Promise<Resposta> {
  const resultadoPin = await verificarPin(codigo, pin);
  if (!resultadoPin.ok) return { status: resultadoPin.status!, body: resultadoPin.body };

  const { status } = (body ?? {}) as { status?: unknown };
  if (status !== 'ativo' && status !== 'comprado') {
    throw new ErroValidacao({ erro: 'status_invalido', mensagem: 'Status deve ser "ativo" ou "comprado".' });
  }

  const lista = await buscarLista(codigo);
  if (!lista) {
    return { status: 404, body: { erro: 'lista_nao_encontrada', mensagem: 'Lista não encontrada.' } };
  }

  const indice = lista.itens.findIndex((item) => item.itemId === itemId);
  if (indice === -1) {
    return { status: 404, body: { erro: 'item_nao_encontrado', mensagem: 'Item não encontrado na lista.' } };
  }

  const novosItens = lista.itens.map((item, i) =>
    i === indice
      ? {
          ...item,
          status: status as StatusItem,
          compradoEm: status === 'comprado' ? new Date().toISOString() : null,
        }
      : item,
  );

  await updateItem(codigo, lista.sk, 'SET itens = :itens', { ':itens': novosItens });
  return { status: 200, body: { listaId: lista.listaId, nome: lista.nome, itens: novosItens } };
}

export async function limparComprados(codigo: string, pin: string | undefined): Promise<Resposta> {
  const resultadoPin = await verificarPin(codigo, pin);
  if (!resultadoPin.ok) return { status: resultadoPin.status!, body: resultadoPin.body };

  const lista = await buscarLista(codigo);
  if (!lista) {
    return { status: 404, body: { erro: 'lista_nao_encontrada', mensagem: 'Lista não encontrada.' } };
  }

  const novosItens = lista.itens.filter((item) => item.status !== 'comprado');
  const removidos = lista.itens.length - novosItens.length;

  await updateItem(codigo, lista.sk, 'SET itens = :itens', { ':itens': novosItens });
  return { status: 200, body: { removidos, listaId: lista.listaId, nome: lista.nome, itens: novosItens } };
}
