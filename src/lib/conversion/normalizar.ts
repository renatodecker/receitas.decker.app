const DIACRITICOS = /[̀-ͯ]/g;

/** Normaliza nome de ingrediente: lowercase, sem acento, trim, espaços colapsados. */
export function normalizarNomeIngrediente(nome: string): string {
  return nome
    .normalize('NFD')
    .replace(DIACRITICOS, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}
