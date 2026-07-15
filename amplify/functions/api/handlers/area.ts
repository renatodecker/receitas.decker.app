import { randomUUID } from 'node:crypto';
import { gerarCodigoArea } from '../codigoArea';
import { putItem, queryArea } from '../db';
import { gerarHashPin } from '../pin';
import type { ListaItem, MetaItem, ReceitaItem } from '../types';
import { ErroValidacao, validarPinFormato } from '../validacao';

interface Resposta {
  status: number;
  body: unknown;
}

const MAX_TENTATIVAS_CODIGO = 5;

export async function criarArea(body: unknown): Promise<Resposta> {
  const { pin, nome } = (body ?? {}) as { pin?: unknown; nome?: unknown };
  validarPinFormato(pin);
  if (nome !== undefined && (typeof nome !== 'string' || nome.length > 80)) {
    throw new ErroValidacao({ erro: 'nome_invalido', mensagem: 'Nome da área inválido (máx. 80 caracteres).' });
  }

  const pinHash = await gerarHashPin(pin);
  const criadaEm = new Date().toISOString();

  let codigo = '';
  let criado = false;
  for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CODIGO && !criado; tentativa++) {
    codigo = gerarCodigoArea();
    const meta: MetaItem = {
      areaCodigo: codigo,
      sk: 'META',
      pinHash,
      nome: (nome as string | undefined)?.trim() || null,
      criadaEm,
      pinFailCount: 0,
      pinLockedUntil: null,
    };
    try {
      await putItem(meta, true);
      criado = true;
    } catch (erro) {
      if (!(erro instanceof Error) || erro.name !== 'ConditionalCheckFailedException') throw erro;
    }
  }
  if (!criado) {
    throw new ErroValidacao({ erro: 'erro_gerar_codigo', mensagem: 'Não foi possível gerar um código único. Tente novamente.' });
  }

  const lista: ListaItem = {
    areaCodigo: codigo,
    sk: `LISTA#${randomUUID()}`,
    listaId: randomUUID(),
    nome: 'Lista de compras',
    itens: [],
  };
  await putItem(lista);

  return { status: 201, body: { codigo } };
}

export async function obterArea(codigo: string): Promise<Resposta> {
  const itens = await queryArea<MetaItem | ReceitaItem | ListaItem>(codigo);
  const meta = itens.find((item): item is MetaItem => item.sk === 'META');
  if (!meta) {
    return { status: 404, body: { erro: 'area_nao_encontrada', mensagem: 'Área não encontrada.' } };
  }
  const receitas = itens.filter((item): item is ReceitaItem => item.sk.startsWith('RECEITA#'));
  const lista = itens.find((item): item is ListaItem => item.sk.startsWith('LISTA#'));

  return {
    status: 200,
    body: {
      meta: { codigo: meta.areaCodigo, nome: meta.nome, criadaEm: meta.criadaEm },
      receitas: receitas.map((r) => ({
        receitaId: r.receitaId,
        nome: r.nome,
        modoPreparo: r.modoPreparo,
        tags: r.tags,
        ingredientes: r.ingredientes,
        criadaEm: r.criadaEm,
      })),
      lista: lista ? { listaId: lista.listaId, nome: lista.nome, itens: lista.itens } : null,
    },
  };
}
