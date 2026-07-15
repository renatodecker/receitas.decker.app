import type { ItemLista } from '../types';
import { formatarQuantidadeComUnidade } from './unidades';

const URL_APP = 'https://receita.decker.app.br';

export function linkCompartilharArea(codigo: string, pin?: string): string {
  const linhas = [
    'Bora usar nossas receitas e lista de compras! 🍲',
    `Código da área: ${codigo}`,
  ];
  if (pin) linhas.push(`PIN: ${pin}`);
  linhas.push(URL_APP);
  return `https://wa.me/?text=${encodeURIComponent(linhas.join('\n'))}`;
}

export function linkCompartilharLista(itensAtivos: ItemLista[]): string {
  const linhas = [
    '🛒 Lista de compras',
    ...itensAtivos.map((item) => `- ${item.nome} (${formatarQuantidadeComUnidade(item.quantidade, item.unidade)})`),
  ];
  return `https://wa.me/?text=${encodeURIComponent(linhas.join('\n'))}`;
}
