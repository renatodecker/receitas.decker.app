import { randomInt } from 'node:crypto';

// Exclui caracteres ambíguos: 0/O, 1/I/L
const ALFABETO = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export function gerarCodigoArea(): string {
  let sufixo = '';
  for (let i = 0; i < 5; i++) {
    sufixo += ALFABETO[randomInt(0, ALFABETO.length)];
  }
  return `RCT-${sufixo}`;
}
