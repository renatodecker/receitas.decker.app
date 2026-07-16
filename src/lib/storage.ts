const CHAVE_CODIGO = 'receitas-decker:codigo';
const CHAVE_PIN = 'receitas-decker:pin';

export interface SessaoArea {
  codigo: string;
  pin: string;
}

// Sessão em memória — vive só durante a aba aberta, nunca é persistida.
// É o que garante que o app funcione na visita atual mesmo sem consentimento
// para lembrar a área no aparelho (preferência "lembrarArea").
let sessaoEmMemoria: SessaoArea | null = null;

/**
 * Define a sessão da área atual. Só grava em localStorage (sobrevive a um
 * reload / nova visita) se `persistir` for true — isto é, se o usuário deu
 * consentimento para a preferência "lembrar minha área neste aparelho".
 * Sem consentimento, a sessão ainda fica disponível em memória para o
 * restante desta visita.
 */
export function definirSessaoArea(sessao: SessaoArea, persistir: boolean): void {
  sessaoEmMemoria = sessao;
  if (persistir) {
    localStorage.setItem(CHAVE_CODIGO, sessao.codigo);
    localStorage.setItem(CHAVE_PIN, sessao.pin);
  }
}

/** Grava em localStorage a sessão que já está em memória, se houver — usado quando o consentimento muda de "não" para "sim" no meio da visita. */
export function persistirSessaoEmMemoria(): void {
  if (!sessaoEmMemoria) return;
  localStorage.setItem(CHAVE_CODIGO, sessaoEmMemoria.codigo);
  localStorage.setItem(CHAVE_PIN, sessaoEmMemoria.pin);
}

export function obterSessaoArea(): SessaoArea | null {
  if (sessaoEmMemoria) return sessaoEmMemoria;
  const codigo = localStorage.getItem(CHAVE_CODIGO);
  const pin = localStorage.getItem(CHAVE_PIN);
  if (!codigo || !pin) return null;
  sessaoEmMemoria = { codigo, pin };
  return sessaoEmMemoria;
}

export function limparSessaoArea(): void {
  sessaoEmMemoria = null;
  localStorage.removeItem(CHAVE_CODIGO);
  localStorage.removeItem(CHAVE_PIN);
}
