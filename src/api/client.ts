import type { AreaCompleta, Ingrediente, ItemLista, Lista, Receita } from '../types';

const API_URL = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  codigo: string;
  constructor(status: number, codigo: string, mensagem: string) {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

interface OpcoesRequisicao {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  pin?: string;
}

async function requisitar<T>(path: string, opcoes: OpcoesRequisicao = {}): Promise<T> {
  if (!API_URL) {
    throw new ApiError(0, 'api_nao_configurada', 'VITE_API_URL não está configurada.');
  }

  const resposta = await fetch(`${API_URL}${path}`, {
    method: opcoes.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(opcoes.pin ? { 'X-Area-Pin': opcoes.pin } : {}),
    },
    body: opcoes.body !== undefined ? JSON.stringify(opcoes.body) : undefined,
  });

  const dados = await resposta.json().catch(() => ({}));

  if (!resposta.ok) {
    throw new ApiError(resposta.status, dados.erro ?? 'erro_desconhecido', dados.mensagem ?? 'Erro desconhecido.');
  }

  return dados as T;
}

export const api = {
  criarArea: (pin: string, nome?: string) =>
    requisitar<{ codigo: string }>('/area', { method: 'POST', body: { pin, nome } }),

  obterArea: (codigo: string) => requisitar<AreaCompleta>(`/area/${codigo}`),

  criarReceita: (
    codigo: string,
    pin: string,
    dados: { nome: string; modoPreparo: string; ingredientes: Ingrediente[] },
  ) => requisitar<Receita>(`/area/${codigo}/receita`, { method: 'POST', body: dados, pin }),

  editarReceita: (
    codigo: string,
    receitaId: string,
    pin: string,
    dados: { nome: string; modoPreparo: string; ingredientes: Ingrediente[] },
  ) => requisitar<Receita>(`/area/${codigo}/receita/${receitaId}`, { method: 'PUT', body: dados, pin }),

  excluirReceita: (codigo: string, receitaId: string, pin: string) =>
    requisitar<{ ok: true }>(`/area/${codigo}/receita/${receitaId}`, { method: 'DELETE', pin }),

  gerarLista: (codigo: string, pin: string, itens: ItemLista[]) =>
    requisitar<Lista>(`/area/${codigo}/lista/gerar`, { method: 'POST', body: { itens }, pin }),

  mudarStatusItem: (codigo: string, pin: string, itemId: string, status: 'ativo' | 'comprado') =>
    requisitar<Lista>(`/area/${codigo}/lista/item/${itemId}`, { method: 'PUT', body: { status }, pin }),

  limparComprados: (codigo: string, pin: string) =>
    requisitar<Lista & { removidos: number }>(`/area/${codigo}/lista/limpar`, { method: 'POST', pin }),
};
