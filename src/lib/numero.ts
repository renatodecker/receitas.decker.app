/** Aceita vírgula ou ponto como separador decimal (ex.: "1,5" ou "1.5"). */
export function parseQuantidade(valor: string): number | null {
  const normalizado = valor.trim().replace(',', '.');
  if (!normalizado) return null;
  const numero = Number(normalizado);
  if (!Number.isFinite(numero) || numero <= 0) return null;
  return numero;
}
