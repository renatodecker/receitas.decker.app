const CHAVE_CODIGO = 'receitas-decker:codigo';
const CHAVE_PIN = 'receitas-decker:pin';

export interface SessaoArea {
  codigo: string;
  pin: string;
}

/**
 * Persiste código + PIN em claro no localStorage. Risco aceito para este
 * domínio (área doméstica, sem dados sensíveis) — a defesa é o rate limit
 * de tentativas de PIN na Lambda, não a proteção do valor no dispositivo.
 */
export function salvarSessaoArea(sessao: SessaoArea): void {
  localStorage.setItem(CHAVE_CODIGO, sessao.codigo);
  localStorage.setItem(CHAVE_PIN, sessao.pin);
}

export function obterSessaoArea(): SessaoArea | null {
  const codigo = localStorage.getItem(CHAVE_CODIGO);
  const pin = localStorage.getItem(CHAVE_PIN);
  if (!codigo || !pin) return null;
  return { codigo, pin };
}

export function limparSessaoArea(): void {
  localStorage.removeItem(CHAVE_CODIGO);
  localStorage.removeItem(CHAVE_PIN);
}
