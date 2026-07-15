import { randomUUID } from 'node:crypto';
import { deleteItem, getItem, putItem } from '../db';
import { verificarPin } from '../pin';
import type { ReceitaItem } from '../types';
import { validarIngredientes, validarModoPreparo, validarNomeReceita } from '../validacao';

interface Resposta {
  status: number;
  body: unknown;
}

function paraPublico(item: ReceitaItem) {
  return {
    receitaId: item.receitaId,
    nome: item.nome,
    modoPreparo: item.modoPreparo,
    tags: item.tags,
    ingredientes: item.ingredientes,
    criadaEm: item.criadaEm,
  };
}

export async function criarReceita(codigo: string, body: unknown, pin: string | undefined): Promise<Resposta> {
  const resultadoPin = await verificarPin(codigo, pin);
  if (!resultadoPin.ok) return { status: resultadoPin.status!, body: resultadoPin.body };

  const { nome, modoPreparo, ingredientes } = (body ?? {}) as Record<string, unknown>;
  validarNomeReceita(nome);
  validarModoPreparo(modoPreparo);
  validarIngredientes(ingredientes);

  const receita: ReceitaItem = {
    areaCodigo: codigo,
    sk: `RECEITA#${randomUUID()}`,
    receitaId: randomUUID(),
    nome: nome.trim(),
    modoPreparo: modoPreparo.trim(),
    tags: [],
    ingredientes,
    criadaEm: new Date().toISOString(),
  };
  await putItem(receita);

  return { status: 201, body: paraPublico(receita) };
}

export async function editarReceita(
  codigo: string,
  receitaId: string,
  body: unknown,
  pin: string | undefined,
): Promise<Resposta> {
  const resultadoPin = await verificarPin(codigo, pin);
  if (!resultadoPin.ok) return { status: resultadoPin.status!, body: resultadoPin.body };

  const existente = await buscarReceita(codigo, receitaId);
  if (!existente) {
    return { status: 404, body: { erro: 'receita_nao_encontrada', mensagem: 'Receita não encontrada.' } };
  }

  const { nome, modoPreparo, ingredientes } = (body ?? {}) as Record<string, unknown>;
  validarNomeReceita(nome);
  validarModoPreparo(modoPreparo);
  validarIngredientes(ingredientes);

  const atualizada: ReceitaItem = {
    ...existente,
    nome: nome.trim(),
    modoPreparo: modoPreparo.trim(),
    ingredientes,
  };
  await putItem(atualizada);

  return { status: 200, body: paraPublico(atualizada) };
}

export async function excluirReceita(codigo: string, receitaId: string, pin: string | undefined): Promise<Resposta> {
  const resultadoPin = await verificarPin(codigo, pin);
  if (!resultadoPin.ok) return { status: resultadoPin.status!, body: resultadoPin.body };

  const existente = await buscarReceita(codigo, receitaId);
  if (!existente) {
    return { status: 404, body: { erro: 'receita_nao_encontrada', mensagem: 'Receita não encontrada.' } };
  }

  await deleteItem(codigo, existente.sk);
  return { status: 200, body: { ok: true } };
}

async function buscarReceita(codigo: string, receitaId: string): Promise<ReceitaItem | undefined> {
  return getItem<ReceitaItem>(codigo, `RECEITA#${receitaId}`);
}
