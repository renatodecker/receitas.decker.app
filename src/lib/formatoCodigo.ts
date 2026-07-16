// Mesmo alfabeto do gerador no backend (amplify/functions/api/codigoArea.ts):
// exclui caracteres ambíguos 0/O, 1/I/L.
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const REGEX_CODIGO = new RegExp(`^RCT-[${ALFABETO}]{5}$`);

export function normalizarCodigo(bruto: string): string {
  return bruto.trim().toUpperCase();
}

export function isCodigoValido(codigo: string): boolean {
  return REGEX_CODIGO.test(codigo);
}
