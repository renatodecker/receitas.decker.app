import type { Unidade } from '../types';

export const UNIDADES: { valor: Unidade; label: string }[] = [
  { valor: 'g', label: 'g' },
  { valor: 'kg', label: 'kg' },
  { valor: 'ml', label: 'ml' },
  { valor: 'l', label: 'l' },
  { valor: 'xicara', label: 'xícara' },
  { valor: 'colher_sopa', label: 'colher de sopa' },
  { valor: 'colher_cha', label: 'colher de chá' },
  { valor: 'unidade', label: 'unidade' },
  { valor: 'pitada', label: 'pitada' },
];

const LABEL_SINGULAR: Record<Unidade, string> = {
  g: 'g',
  kg: 'kg',
  ml: 'ml',
  l: 'l',
  xicara: 'xícara',
  colher_sopa: 'colher de sopa',
  colher_cha: 'colher de chá',
  unidade: 'un',
  pitada: 'pitada',
};

const LABEL_PLURAL: Record<Unidade, string> = {
  ...LABEL_SINGULAR,
  xicara: 'xícaras',
  colher_sopa: 'colheres de sopa',
  colher_cha: 'colheres de chá',
  pitada: 'pitadas',
};

const SEM_ESPACO = new Set<Unidade>(['g', 'kg', 'ml', 'l']);

export function formatarQuantidade(quantidade: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(quantidade);
}

/** Formata "1kg", "500g", "12 un", "2 xícaras" — para exibição e compartilhamento. */
export function formatarQuantidadeComUnidade(quantidade: number, unidade: Unidade): string {
  const numero = formatarQuantidade(quantidade);
  if (SEM_ESPACO.has(unidade)) {
    return `${numero}${LABEL_SINGULAR[unidade]}`;
  }
  if (unidade === 'unidade') {
    return `${numero} un`;
  }
  const label = quantidade === 1 ? LABEL_SINGULAR[unidade] : LABEL_PLURAL[unidade];
  return `${numero} ${label}`;
}
